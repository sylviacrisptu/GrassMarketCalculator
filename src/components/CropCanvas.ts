export interface CropCanvasOptions {
  canvas: HTMLCanvasElement;
  image: HTMLImageElement;
}

interface DisplayedImageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CropRect {
  x: number;
  y: number;
  size: number;
}

type DragMode =
  | "none"
  | "move-crop"
  | "pan-image"
  | "resize-top-left"
  | "resize-top-right"
  | "resize-bottom-left"
  | "resize-bottom-right";

const HANDLE_SIZE = 18;
const HANDLE_HIT_SIZE = 24;
const MIN_CROP_SIZE = 36;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

export class CropCanvas {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly image: HTMLImageElement;

  private imageRect: DisplayedImageRect;
  private cropRect: CropRect;

  private fittedImageRect: DisplayedImageRect;
  private zoom = 1;

  private dragMode: DragMode = "none";
  private hoverMode: DragMode = "none";

  private lastPointerX = 0;
  private lastPointerY = 0;

  private gridVisible = true;

  private readonly onPointerDownBound:
    (event: PointerEvent) => void;

  private readonly onPointerMoveBound:
    (event: PointerEvent) => void;

  private readonly onPointerUpBound:
    (event: PointerEvent) => void;

  private readonly onWheelBound:
    (event: WheelEvent) => void;

  private readonly onDoubleClickBound:
    () => void;

  constructor(options: CropCanvasOptions) {
    this.canvas = options.canvas;
    this.image = options.image;

    const context = this.canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas rendering is unavailable.");
    }

    this.context = context;

    this.fittedImageRect = this.calculateFittedImageRect();
    this.imageRect = { ...this.fittedImageRect };
    this.cropRect = this.createInitialCrop();

    this.onPointerDownBound =
      this.onPointerDown.bind(this);

    this.onPointerMoveBound =
      this.onPointerMove.bind(this);

    this.onPointerUpBound =
      this.onPointerUp.bind(this);

    this.onWheelBound =
      this.onWheel.bind(this);

    this.onDoubleClickBound =
      this.reset.bind(this);

    this.canvas.addEventListener(
      "pointerdown",
      this.onPointerDownBound,
    );

    window.addEventListener(
      "pointermove",
      this.onPointerMoveBound,
    );

    window.addEventListener(
      "pointerup",
      this.onPointerUpBound,
    );

    this.canvas.addEventListener(
      "wheel",
      this.onWheelBound,
      { passive: false },
    );

    this.canvas.addEventListener(
      "dblclick",
      this.onDoubleClickBound,
    );

    this.draw();
  }

  public destroy(): void {
    this.canvas.removeEventListener(
      "pointerdown",
      this.onPointerDownBound,
    );

    window.removeEventListener(
      "pointermove",
      this.onPointerMoveBound,
    );

    window.removeEventListener(
      "pointerup",
      this.onPointerUpBound,
    );

    this.canvas.removeEventListener(
      "wheel",
      this.onWheelBound,
    );

    this.canvas.removeEventListener(
      "dblclick",
      this.onDoubleClickBound,
    );
  }

  public reset(): void {
    this.zoom = 1;

    this.fittedImageRect =
      this.calculateFittedImageRect();

    this.imageRect = {
      ...this.fittedImageRect,
    };

    this.cropRect =
      this.createInitialCrop();

    this.dragMode = "none";
    this.hoverMode = "none";

    this.draw();
    this.updateCursor();
  }

  public setGridVisible(
    visible: boolean,
  ): void {
    this.gridVisible = visible;
    this.draw();
  }

  public exportDataUrl(
    size = 32,
  ): string {
    const outputCanvas =
      document.createElement("canvas");

    outputCanvas.width = size;
    outputCanvas.height = size;

    const outputContext =
      outputCanvas.getContext("2d");

    if (!outputContext) {
      throw new Error(
        "Canvas rendering is unavailable.",
      );
    }

    const sourceX =
      ((this.cropRect.x - this.imageRect.x) /
        this.imageRect.width) *
      this.image.naturalWidth;

    const sourceY =
      ((this.cropRect.y - this.imageRect.y) /
        this.imageRect.height) *
      this.image.naturalHeight;

    const sourceWidth =
      (this.cropRect.size /
        this.imageRect.width) *
      this.image.naturalWidth;

    const sourceHeight =
      (this.cropRect.size /
        this.imageRect.height) *
      this.image.naturalHeight;

    outputContext.clearRect(
      0,
      0,
      size,
      size,
    );

    outputContext.imageSmoothingEnabled =
      false;

    outputContext.drawImage(
      this.image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      size,
      size,
    );

    return outputCanvas.toDataURL(
      "image/png",
    );
  }

  private calculateFittedImageRect():
    DisplayedImageRect {
    const canvasWidth =
      this.canvas.width;

    const canvasHeight =
      this.canvas.height;

    const scale = Math.min(
      canvasWidth /
        this.image.naturalWidth,
      canvasHeight /
        this.image.naturalHeight,
    );

    const width =
      this.image.naturalWidth * scale;

    const height =
      this.image.naturalHeight * scale;

    return {
      x: (canvasWidth - width) / 2,
      y: (canvasHeight - height) / 2,
      width,
      height,
    };
  }

  private createInitialCrop(): CropRect {
    const size =
      Math.min(
        this.imageRect.width,
        this.imageRect.height,
      ) * 0.72;

    return {
      x:
        this.imageRect.x +
        (this.imageRect.width - size) / 2,

      y:
        this.imageRect.y +
        (this.imageRect.height - size) / 2,

      size,
    };
  }

  private draw(): void {
    this.context.clearRect(
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );

    this.drawCheckerboard();

    this.context.imageSmoothingEnabled =
      true;

    this.context.drawImage(
      this.image,
      this.imageRect.x,
      this.imageRect.y,
      this.imageRect.width,
      this.imageRect.height,
    );

    this.drawDarkenedOutsideArea();
    this.drawCropBorder();

    if (this.gridVisible) {
      this.drawGridLines();
    }

    this.drawHandles();
  }

  private drawCheckerboard(): void {
    const size = 16;

    for (
      let y = 0;
      y < this.canvas.height;
      y += size
    ) {
      for (
        let x = 0;
        x < this.canvas.width;
        x += size
      ) {
        const alternating =
          (x / size + y / size) % 2 === 0;

        this.context.fillStyle =
          alternating
            ? "#d9dddb"
            : "#bfc5c2";

        this.context.fillRect(
          x,
          y,
          size,
          size,
        );
      }
    }
  }

  private drawDarkenedOutsideArea():
    void {
    const { x, y, size } =
      this.cropRect;

    this.context.save();

    this.context.fillStyle =
      "rgba(20, 23, 22, 0.68)";

    this.context.beginPath();

    this.context.rect(
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );

    this.context.rect(
      x,
      y,
      size,
      size,
    );

    this.context.fill("evenodd");
    this.context.restore();
  }

  private drawCropBorder(): void {
    const { x, y, size } =
      this.cropRect;

    this.context.save();

    this.context.strokeStyle =
      "#ffffff";

    this.context.lineWidth = 2;

    this.context.strokeRect(
      x,
      y,
      size,
      size,
    );

    this.context.strokeStyle =
      "rgba(0, 0, 0, 0.75)";

    this.context.lineWidth = 1;

    this.context.strokeRect(
      x - 1,
      y - 1,
      size + 2,
      size + 2,
    );

    this.context.restore();
  }

  private drawGridLines(): void {
    const { x, y, size } =
      this.cropRect;

    this.context.save();

    this.context.strokeStyle =
      "rgba(255, 255, 255, 0.48)";

    this.context.lineWidth = 1;

    for (
      const division of
      [1 / 3, 2 / 3]
    ) {
      const lineX =
        x + size * division;

      const lineY =
        y + size * division;

      this.context.beginPath();
      this.context.moveTo(lineX, y);
      this.context.lineTo(
        lineX,
        y + size,
      );
      this.context.stroke();

      this.context.beginPath();
      this.context.moveTo(x, lineY);
      this.context.lineTo(
        x + size,
        lineY,
      );
      this.context.stroke();
    }

    this.context.restore();
  }

  private drawHandles(): void {
    const handles =
      this.getHandlePositions();

    this.context.save();

    for (const handle of handles) {
      const highlighted =
        this.hoverMode === handle.mode ||
        this.dragMode === handle.mode;

      const size = highlighted
        ? HANDLE_SIZE + 4
        : HANDLE_SIZE;

      this.context.fillStyle =
        highlighted
          ? "#72bea0"
          : "#ffffff";

      this.context.strokeStyle =
        "rgba(0, 0, 0, 0.82)";

      this.context.lineWidth = 2;

      this.context.fillRect(
        handle.x - size / 2,
        handle.y - size / 2,
        size,
        size,
      );

      this.context.strokeRect(
        handle.x - size / 2,
        handle.y - size / 2,
        size,
        size,
      );
    }

    this.context.restore();
  }

  private getHandlePositions(): Array<{
    mode: DragMode;
    x: number;
    y: number;
  }> {
    const { x, y, size } =
      this.cropRect;

    return [
      {
        mode: "resize-top-left",
        x,
        y,
      },
      {
        mode: "resize-top-right",
        x: x + size,
        y,
      },
      {
        mode: "resize-bottom-left",
        x,
        y: y + size,
      },
      {
        mode: "resize-bottom-right",
        x: x + size,
        y: y + size,
      },
    ];
  }

  private onPointerDown(
    event: PointerEvent,
  ): void {
    const point =
      this.getCanvasPoint(event);

    if (
      event.button === 1 ||
      event.altKey
    ) {
      this.dragMode = "pan-image";
    } else {
      this.dragMode =
        this.getDragModeAtPoint(
          point.x,
          point.y,
        );
    }

    if (this.dragMode === "none") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.canvas.setPointerCapture(
      event.pointerId,
    );

    this.lastPointerX = point.x;
    this.lastPointerY = point.y;

    this.updateCursor();
  }

  private onPointerMove(
    event: PointerEvent,
  ): void {
    const point =
      this.getCanvasPoint(event);

    if (this.dragMode === "none") {
      this.hoverMode =
        this.getDragModeAtPoint(
          point.x,
          point.y,
        );

      this.updateCursor();
      this.draw();
      return;
    }

    event.preventDefault();

    const deltaX =
      point.x - this.lastPointerX;

    const deltaY =
      point.y - this.lastPointerY;

    if (
      this.dragMode === "move-crop"
    ) {
      this.moveCrop(
        deltaX,
        deltaY,
      );
    } else if (
      this.dragMode === "pan-image"
    ) {
      this.panImage(
        deltaX,
        deltaY,
      );
    } else {
      this.resizeCrop(
        point.x,
        point.y,
        this.dragMode,
      );
    }

    this.lastPointerX = point.x;
    this.lastPointerY = point.y;

    this.draw();
  }

  private onPointerUp(
    event: PointerEvent,
  ): void {
    if (this.dragMode === "none") {
      return;
    }

    if (
      this.canvas.hasPointerCapture(
        event.pointerId,
      )
    ) {
      this.canvas.releasePointerCapture(
        event.pointerId,
      );
    }

    this.dragMode = "none";
    this.updateCursor();
    this.draw();
  }

  private onWheel(
    event: WheelEvent,
  ): void {
    event.preventDefault();
    event.stopPropagation();

    const point =
      this.getCanvasPoint(event);

    const zoomFactor =
      event.deltaY < 0
        ? 1.12
        : 1 / 1.12;

    this.zoomImageAtPoint(
      zoomFactor,
      point.x,
      point.y,
    );
  }

  private zoomImageAtPoint(
    factor: number,
    pointX: number,
    pointY: number,
  ): void {
    const nextZoom = Math.min(
      MAX_ZOOM,
      Math.max(
        MIN_ZOOM,
        this.zoom * factor,
      ),
    );

    if (nextZoom === this.zoom) {
      return;
    }

    const imagePointX =
      (pointX - this.imageRect.x) /
      this.imageRect.width;

    const imagePointY =
      (pointY - this.imageRect.y) /
      this.imageRect.height;

    this.zoom = nextZoom;

    const newWidth =
      this.fittedImageRect.width *
      this.zoom;

    const newHeight =
      this.fittedImageRect.height *
      this.zoom;

    this.imageRect.width = newWidth;
    this.imageRect.height = newHeight;

    this.imageRect.x =
      pointX -
      imagePointX * newWidth;

    this.imageRect.y =
      pointY -
      imagePointY * newHeight;

    this.constrainImageToCrop();
    this.constrainCropToImage();

    this.draw();
  }

  private panImage(
    deltaX: number,
    deltaY: number,
  ): void {
    this.imageRect.x += deltaX;
    this.imageRect.y += deltaY;

    this.constrainImageToCrop();
  }

  private constrainImageToCrop():
    void {
    const cropRight =
      this.cropRect.x +
      this.cropRect.size;

    const cropBottom =
      this.cropRect.y +
      this.cropRect.size;

    const imageRight =
      this.imageRect.x +
      this.imageRect.width;

    const imageBottom =
      this.imageRect.y +
      this.imageRect.height;

    if (
      this.imageRect.x >
      this.cropRect.x
    ) {
      this.imageRect.x =
        this.cropRect.x;
    }

    if (
      this.imageRect.y >
      this.cropRect.y
    ) {
      this.imageRect.y =
        this.cropRect.y;
    }

    if (imageRight < cropRight) {
      this.imageRect.x +=
        cropRight - imageRight;
    }

    if (imageBottom < cropBottom) {
      this.imageRect.y +=
        cropBottom - imageBottom;
    }
  }

  private constrainCropToImage():
    void {
    this.cropRect.size = Math.min(
      this.cropRect.size,
      this.imageRect.width,
      this.imageRect.height,
    );

    const maxX =
      this.imageRect.x +
      this.imageRect.width -
      this.cropRect.size;

    const maxY =
      this.imageRect.y +
      this.imageRect.height -
      this.cropRect.size;

    this.cropRect.x = Math.min(
      maxX,
      Math.max(
        this.imageRect.x,
        this.cropRect.x,
      ),
    );

    this.cropRect.y = Math.min(
      maxY,
      Math.max(
        this.imageRect.y,
        this.cropRect.y,
      ),
    );
  }

  private moveCrop(
    deltaX: number,
    deltaY: number,
  ): void {
    const maxX =
      this.imageRect.x +
      this.imageRect.width -
      this.cropRect.size;

    const maxY =
      this.imageRect.y +
      this.imageRect.height -
      this.cropRect.size;

    this.cropRect.x = Math.min(
      maxX,
      Math.max(
        this.imageRect.x,
        this.cropRect.x + deltaX,
      ),
    );

    this.cropRect.y = Math.min(
      maxY,
      Math.max(
        this.imageRect.y,
        this.cropRect.y + deltaY,
      ),
    );
  }

  private resizeCrop(
    pointerX: number,
    pointerY: number,
    mode: DragMode,
  ): void {
    const right =
      this.cropRect.x +
      this.cropRect.size;

    const bottom =
      this.cropRect.y +
      this.cropRect.size;

    let anchorX = this.cropRect.x;
    let anchorY = this.cropRect.y;
    let proposedSize =
      this.cropRect.size;

    if (
      mode === "resize-top-left"
    ) {
      anchorX = right;
      anchorY = bottom;

      proposedSize = Math.max(
        anchorX - pointerX,
        anchorY - pointerY,
      );

      proposedSize =
        this.limitSizeFromAnchor(
          anchorX,
          anchorY,
          proposedSize,
          -1,
          -1,
        );

      this.cropRect.x =
        anchorX - proposedSize;

      this.cropRect.y =
        anchorY - proposedSize;

      this.cropRect.size =
        proposedSize;

      return;
    }

    if (
      mode === "resize-top-right"
    ) {
      anchorX = this.cropRect.x;
      anchorY = bottom;

      proposedSize = Math.max(
        pointerX - anchorX,
        anchorY - pointerY,
      );

      proposedSize =
        this.limitSizeFromAnchor(
          anchorX,
          anchorY,
          proposedSize,
          1,
          -1,
        );

      this.cropRect.y =
        anchorY - proposedSize;

      this.cropRect.size =
        proposedSize;

      return;
    }

    if (
      mode === "resize-bottom-left"
    ) {
      anchorX = right;
      anchorY = this.cropRect.y;

      proposedSize = Math.max(
        anchorX - pointerX,
        pointerY - anchorY,
      );

      proposedSize =
        this.limitSizeFromAnchor(
          anchorX,
          anchorY,
          proposedSize,
          -1,
          1,
        );

      this.cropRect.x =
        anchorX - proposedSize;

      this.cropRect.size =
        proposedSize;

      return;
    }

    if (
      mode === "resize-bottom-right"
    ) {
      anchorX = this.cropRect.x;
      anchorY = this.cropRect.y;

      proposedSize = Math.max(
        pointerX - anchorX,
        pointerY - anchorY,
      );

      proposedSize =
        this.limitSizeFromAnchor(
          anchorX,
          anchorY,
          proposedSize,
          1,
          1,
        );

      this.cropRect.size =
        proposedSize;
    }
  }

  private limitSizeFromAnchor(
    anchorX: number,
    anchorY: number,
    requestedSize: number,
    horizontalDirection: -1 | 1,
    verticalDirection: -1 | 1,
  ): number {
    const horizontalLimit =
      horizontalDirection === 1
        ? this.imageRect.x +
          this.imageRect.width -
          anchorX
        : anchorX -
          this.imageRect.x;

    const verticalLimit =
      verticalDirection === 1
        ? this.imageRect.y +
          this.imageRect.height -
          anchorY
        : anchorY -
          this.imageRect.y;

    return Math.max(
      MIN_CROP_SIZE,
      Math.min(
        requestedSize,
        horizontalLimit,
        verticalLimit,
      ),
    );
  }

  private getDragModeAtPoint(
    x: number,
    y: number,
  ): DragMode {
    for (
      const handle of
      this.getHandlePositions()
    ) {
      const distanceX =
        Math.abs(x - handle.x);

      const distanceY =
        Math.abs(y - handle.y);

      if (
        distanceX <=
          HANDLE_HIT_SIZE &&
        distanceY <=
          HANDLE_HIT_SIZE
      ) {
        return handle.mode;
      }
    }

    const insideCrop =
      x >= this.cropRect.x &&
      x <=
        this.cropRect.x +
          this.cropRect.size &&
      y >= this.cropRect.y &&
      y <=
        this.cropRect.y +
          this.cropRect.size;

    return insideCrop
      ? "move-crop"
      : "none";
  }

  private getCanvasPoint(
    event:
      PointerEvent |
      WheelEvent,
  ): {
    x: number;
    y: number;
  } {
    const bounds =
      this.canvas.getBoundingClientRect();

    return {
      x:
        (event.clientX - bounds.left) *
        (
          this.canvas.width /
          bounds.width
        ),

      y:
        (event.clientY - bounds.top) *
        (
          this.canvas.height /
          bounds.height
        ),
    };
  }

  private updateCursor(): void {
    const mode =
      this.dragMode !== "none"
        ? this.dragMode
        : this.hoverMode;

    switch (mode) {
      case "move-crop":
        this.canvas.style.cursor =
          this.dragMode === "move-crop"
            ? "grabbing"
            : "grab";
        break;

      case "pan-image":
        this.canvas.style.cursor =
          "move";
        break;

      case "resize-top-left":
      case "resize-bottom-right":
        this.canvas.style.cursor =
          "nwse-resize";
        break;

      case "resize-top-right":
      case "resize-bottom-left":
        this.canvas.style.cursor =
          "nesw-resize";
        break;

      default:
        this.canvas.style.cursor =
          "default";
        break;
    }
  }
}