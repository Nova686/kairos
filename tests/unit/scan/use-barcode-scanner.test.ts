// @vitest-environment happy-dom
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
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

  it('sets the code once when several decode callbacks fire', async () => {
    const controls = { stop: vi.fn() }
    let decodeCallback: DecodeCallback = () => {}
    readerBehaviour.decodeFromConstraints.mockImplementation(async (_constraints, _video, callback: DecodeCallback) => {
      decodeCallback = callback
      return controls
    })
    const { scanner } = mountScanner()
    await scanner.start()

    decodeCallback({ getText: () => '3017620422003' }, undefined, controls)
    decodeCallback({ getText: () => '5449000000996' }, undefined, controls)

    expect(scanner.lastCode.value).toBe('3017620422003')
  })

  it('stops the camera that finishes opening after stop was called while starting', async () => {
    const controls = { stop: vi.fn() }
    let releaseCamera: (value: typeof controls) => void = () => {}
    readerBehaviour.decodeFromConstraints.mockReturnValue(new Promise((resolve) => {
      releaseCamera = resolve
    }))
    const { scanner } = mountScanner()
    const starting = scanner.start()
    await flushPromises()
    expect(scanner.cameraState.value).toBe('starting')

    scanner.stop()
    releaseCamera(controls)
    await starting

    expect(controls.stop).toHaveBeenCalled()
    expect(scanner.cameraState.value).toBe('idle')
  })

  it('stops a camera still opening when the page is hidden', async () => {
    const controls = { stop: vi.fn() }
    let releaseCamera: (value: typeof controls) => void = () => {}
    readerBehaviour.decodeFromConstraints.mockReturnValue(new Promise((resolve) => {
      releaseCamera = resolve
    }))
    const { scanner } = mountScanner()
    const starting = scanner.start()
    await flushPromises()

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    releaseCamera(controls)
    await starting
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })

    expect(controls.stop).toHaveBeenCalled()
    expect(scanner.cameraState.value).toBe('idle')
  })

  it('stops the camera on pagehide', async () => {
    const controls = { stop: vi.fn() }
    readerBehaviour.decodeFromConstraints.mockResolvedValue(controls)
    const { scanner } = mountScanner()
    await scanner.start()

    window.dispatchEvent(new Event('pagehide'))

    expect(controls.stop).toHaveBeenCalled()
    expect(scanner.cameraState.value).toBe('idle')
  })

  it('stops the tracks when the scanner is removed by a v-if, as when leaving its tab', async () => {
    const controls = { stop: vi.fn() }
    readerBehaviour.decodeFromConstraints.mockResolvedValue(controls)
    const fakeTrack = { stop: vi.fn() }
    const isTabActive = ref(true)
    let scanner!: ReturnType<typeof useBarcodeScanner>
    const ScannerTab = defineComponent({
      setup() {
        scanner = useBarcodeScanner()
        scanner.videoElement.value = { srcObject: { getTracks: () => [fakeTrack] } } as unknown as HTMLVideoElement
        return () => h('div')
      },
    })
    mount(defineComponent({ setup: () => () => (isTabActive.value ? h(ScannerTab) : h('p')) }))
    await scanner.start()

    isTabActive.value = false
    await flushPromises()

    expect(controls.stop).toHaveBeenCalled()
    expect(fakeTrack.stop).toHaveBeenCalled()
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
