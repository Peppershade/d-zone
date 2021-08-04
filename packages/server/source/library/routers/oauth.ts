import Router from 'koa-router'
import { StatusCodes } from 'http-status-codes'

import {
	OAuth2Routes,
	OAuth2Scopes,
	RESTPostOAuth2AccessTokenResult,
} from 'discord-api-types/v9'

import axios from 'axios'

import { URL, URLSearchParams } from 'url'
import { Logger } from 'tslog'
import { DZoneInternalError, handleError } from '../utils/error'

/**
 * Creates router to handle oauth and sessions.
 *
 * - `GET /discord/callback` discord redirects the user back here
 * - `GET /discord/redirect` user redirected to discord provider
 *
 * @param options Create OAuth router options
 * @returns Router
 */
export function createOAuthRouter({
	routerOptions,
	options,
}: {
	logger: Logger
	routerOptions: Router.IRouterOptions
	options: { clientId: string; clientSecret: string; baseUrl: string }
}) {
	const router = new Router(routerOptions)

	const discordRedirectUrl = generateDiscordRedirectUrl(
		options.clientId,
		options.baseUrl + '/discord/callback'
	)

	router.redirect(
		'/discord/redirect',
		discordRedirectUrl,
		StatusCodes.TEMPORARY_REDIRECT
	)

	router.get('/discord/callback', async (context) => {
		const searchParams = new URLSearchParams(context.search)
		const code = searchParams.get('code')

		if (!code) {
			context.status = StatusCodes.BAD_REQUEST
			return
		}

		const response = await requestDiscordToken({
			code,
			clientId: options.clientId,
			clientSecret: options.clientSecret,
			redirectUri: options.baseUrl + '/discord/callback',
		})

		if (response.error) {
			handleError(response.error)
			context.status = StatusCodes.INTERNAL_SERVER_ERROR
			return
		}

		// TODO: Do something with token

		context.status = StatusCodes.OK
	})

	return router
}

/**
 * Generates the discord redirect url
 *
 * @param clientId - Application client id
 * @param callbackUrl - Application callback url
 * @returns - Url as string
 */
function generateDiscordRedirectUrl(clientId: string, callbackUrl: string) {
	const url = new URL(OAuth2Routes.authorizationURL)

	const params = {
		client_id: clientId,
		redirect_uri: callbackUrl,
		response_type: 'code',
		scope: `${OAuth2Scopes.Email} ${OAuth2Scopes.Identify}`,
		prompt: 'none',
	}

	for (const key in params)
		url.searchParams.set(key, params[key as keyof typeof params])

	return url.toString()
}

/**
 * Requests a new user token
 *
 * @param options - Discord token request options
 * @returns Token or error
 */
async function requestDiscordToken(options: {
	code: string
	clientId: string
	clientSecret: string
	redirectUri: string
}) {
	const body = new URLSearchParams({
		code: options.code,
		client_id: options.clientId,
		client_secret: options.clientSecret,
		grant_type: 'authorization_code',
		redirect_uri: options.redirectUri,
	})

	return axios
		.post<RESTPostOAuth2AccessTokenResult>(OAuth2Routes.tokenURL, body)
		.then((res) => ({ error: null, token: res.data.access_token }))
		.catch((error) => ({
			error: DZoneInternalError.fromAxiosError(error, true),
		}))
}