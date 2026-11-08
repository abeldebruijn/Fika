import { pipeline } from '@huggingface/transformers'

const modelId = 'onnx-community/SmolLM2-135M-Instruct-ONNX'
let generator

self.onmessage = async ({ data }) => {
  const { type, words } = data
  try {
    if (!generator) {
      self.postMessage({ type: 'status', message: 'Model laden. De eerste keer worden modelbestanden gedownload.' })
      generator = await pipeline('text-generation', modelId, {
        device: 'wasm',
        dtype: 'q4',
        progress_callback: event => {
          if (event.status === 'progress') {
            self.postMessage({ type: 'progress', file: event.file, loaded: event.loaded, total: event.total, progress: event.progress })
          } else if (event.status === 'initiate' || event.status === 'done') {
            self.postMessage({ type: 'status', message: `${event.status}: ${event.file ?? 'model'}` })
          }
        },
      })
      self.postMessage({ type: 'ready' })
    }
    if (type === 'generate') {
      self.postMessage({ type: 'status', message: 'Zin genereren op dit apparaat…' })
      const result = await generator([
        { role: 'system', content: 'You are a Swedish language tutor. Reply only with one short natural Swedish travel sentence using some of the given words. No translation or explanation.' },
        { role: 'user', content: `Words: ${words}. Give one Swedish travel sentence with 3 to 6 words.` },
      ], { max_new_tokens: 40, do_sample: false })
      const generated = result[0]?.generated_text
      const output = Array.isArray(generated) ? generated.at(-1)?.content : generated
      self.postMessage({ type: 'result', output: String(output ?? '').trim() })
    }
  } catch (error) {
    generator = undefined
    self.postMessage({ type: 'error', name: error?.name ?? 'Error', message: error?.message ?? String(error), stack: error?.stack ?? '' })
  }
}
