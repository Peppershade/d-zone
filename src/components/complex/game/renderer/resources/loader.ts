import * as PIXI from 'pixi.js-legacy'
import spriteConfig from 'web/art/sprite-config.json'
import { LoaderResource } from 'pixi.js-legacy'

interface FrameConfig {
	w: number
	h: number
	animation?: boolean
	anchor?: { x: number; y: number }
}

function parseSheet(sheet: LoaderResource, next: () => void) {
	if (sheet.extension === 'json') {
		// @ts-expect-error "onComplete" event emitter does, in fact, exist
		sheet.onComplete.once((res: LoaderResource) => {
			if (!res.data) return
			const animations: Record<string, string[]> = {}
			for (const frameKey of Object.keys(res.data.frames)) {
				const layer = frameKey.split(':')[0]
				const frame = res.data.frames[frameKey as keyof typeof res.data.frames]
				const config: FrameConfig =
					spriteConfig.frames[layer as keyof typeof spriteConfig.frames]
				frame.sourceSize.w = config.w
				frame.sourceSize.h = config.h
				if (config.anchor) {
					frame.anchor = {
						x: config.anchor.x / config.w, // Normalize to [0,1]
						y: config.anchor.y / config.h,
					}
				}
				if (config.animation) {
					animations[layer] = animations[layer] || []
					animations[layer].push(frameKey)
				}
			}
			sheet.data.animations = animations
		})
	}
	next()
}

let loader: PIXI.Loader

export function initLoader() {
	loader = new PIXI.Loader()
	loader.add('./img/sprites.json')
	loader.pre(parseSheet)
}

export async function runLoader(): Promise<
	Partial<Record<string, LoaderResource>>
> {
	return new Promise((resolve, reject) => {
		loader.load((_loader, resources) => {
			Object.keys(resources).forEach((resourceKey) => {
				const resource = resources[resourceKey]
				if (resource && resource.error) reject(resource.error)
			})
			resolve(resources)
		})
	})
}
