// @vitest-environment happy-dom
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { useBarcodeScanner } from '../../../app/composables/useBarcodeScanner.ts'

type DecodeCallback = (
  result: { getText: () => string } | undefined,
  failure: Error | undefined,
  controls: { stop: () => void },
) => void

const readerBehaviour = vi.hoisted(() => ({
  decodeFromConstraints: vi.fn(),
}))

vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: class {
    decodeFromConstraints(...decodeArguments: unknown[]) {
      return readerBehaviour.decodeFromConstraints(...decodeArguments)
    }
  },
}))

const mountScanner = () => {
  let scanner!: ReturnType<typeof useBarcodeScanner>
  const wrapper = mount(defineComponent({
    setup() {
      scanner = useBarcodeScanner()
      return () => h('div')
    },
  }))
  const fakeTrack = { stop: vi.fn() }
  scanner.videoElement.value = { srcObject: { getTracks: () => [fakeTrack] } } as unknown as HTMLVideoElement
  return { scanner, wrapper, fakeTrack }
}

describe('useBarcodeScanner', () => {
  beforeEach(() => {
    readerBehaviour.decodeFromConstraints.mockReset()
    Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true })
  })

  it('reports denied when the camera permission is refused', async () => {
    readerBehaviour.decodeFromConstraints.mockRejectedValue(new DOMException('refused', 'NotAllowedError'))
    const { scanner } = mountScanner()

    await scanner.start()

    expect(scanner.cameraState.value).toBe('denied')
  })

  it('reports unavailable when no camera can be opened', async () => {
    readerBehaviour.decodeFromConstraints.mockRejectedValue(new DOMException('none', 'NotFoundError'))
    const { scanner } = mountScanner()

    await scanner.start()

    expect(scanner.cameraState.value).toBe('unavailable')
  })

  it('requests the environment camera and scans until a first code is decoded', async () => {
    const controls = { stop: vi.fn() }
    let decodeCallback: DecodeCallback = () => {}
    readerBehaviour.decodeFromConstraints.mockImplementation(async (_constraints, _video, callback: DecodeCallback) => {
      decodeCallback = callback
      return controls
    })
    const { scanner } = mountScanner()

    await scanner.start()

    expect(scanner.cameraState.value).toBe('scanning')
    expect(readerBehaviour.decodeFromConstraints.mock.calls[0]![0]).toEqual({
      video: { facingMode: 'environment' },
    })

    decodeCallback({ getText: () => '3017620422003' }, undefined, controls)

    expect(scanner.lastCode.value).toBe('3017620422003')
    expect(controls.stop).toHaveBeenCalled()
    expect(scanner.cameraState.value).toBe('idle')
  })

  it('ignores decoding failures while scanning', async () => {
    const controls = { stop: vi.fn() }
    let decodeCallback: DecodeCallback = () => {}
    readerBehaviour.decodeFromConstraints.mockImplementation(async (_constraints, _video, callback: DecodeCallback) => {
      decodeCallback = callback
      return controls
    })
    const { scanner } = mountScanner()
    await scanner.start()

    decodeCallback(undefined, new Error('not found'), controls)

    expect(scanner.lastCode.value).toBeNull()
    expect(scanner.cameraState.value).toBe('scanning')
  })

  it('stops the reader and the video tracks when the component unmounts', async () => {
    const controls = { stop: vi.fn() }
    readerBehaviour.decodeFromConstraints.mockResolvedValue(controls)
    const { scanner, wrapper, fakeTrack } = mountScanner()
    await scanner.start()

    wrapper.unmount()
    await flushPromises()

    expect(controls.stop).toHaveBeenCalled()
    expect(fakeTrack.stop).toHaveBeenCalled()
    expect(scanner.cameraState.value).toBe('idle')
  })

  it('stops the camera when the page becomes hidden', async () => {
    const controls = { stop: vi.fn() }
    readerBehaviour.decodeFromConstraints.mockResolvedValue(controls)
    const { scanner } = mountScanner()
    await scanner.start()

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(controls.stop).toHaveBeenCalled()
    expect(scanner.cameraState.value).toBe('idle')
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })
})
