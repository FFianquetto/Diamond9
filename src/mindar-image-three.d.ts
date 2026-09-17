declare module 'mindar-image-three' {
  export class MindARThree {
    constructor(opts: {
      container: HTMLElement;
      imageTargetSrc: string;
      maxTrack?: number;
      uiLoading?: string;
      uiScanning?: string;
      uiError?: string;
      filterMinCF?: number;
      filterBeta?: number;
      warmupTolerance?: number;
      missTolerance?: number;
    });

    start(): Promise<void>;
    stop(): void;
    addAnchor(targetIndex: number): {
      onTargetFound: (() => void) | null;
      onTargetLost: (() => void) | null;
      group: { visible: boolean; add: (obj: unknown) => void };
    };

    video: HTMLVideoElement;
    scene: unknown;
    camera: unknown;
    renderer: {
      domElement: HTMLElement;
      setAnimationLoop: (cb: null | (() => void)) => void;
      render: (scene: unknown, camera: unknown) => void;
    };
    cssRenderer: { domElement: HTMLElement };
  }
}
