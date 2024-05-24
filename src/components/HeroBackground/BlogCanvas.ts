import { MantineColorScheme } from "@mantine/core";
import { Canvas, MousePosition } from "./Canvas";
import { Shared, Square } from "./Square";

export class BlogCanvas extends Canvas {
  private filteredSquares: Square[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    colorScheme: MantineColorScheme,
    mousePos?: MousePosition
  ) {
    super(canvas, colorScheme, mousePos);
  }

  public override run(
    timeStamp: DOMHighResTimeStamp,
    onAnimationFrameRequest: (id: number) => void
  ) {
    this.animateSquares(timeStamp);
    super.tick(onAnimationFrameRequest);
  }

  private get cpx() {
    return this.canvas.width * 0.5;
  }

  private get cpy() {
    return this.canvas.height * 0.75;
  }

  private calculateStartingX() {
    const minWidth = 320; // width at which x should be 0
    const maxWidth = 1440; // width at which x should be 1/3 of canvas width

    if (this.canvas.width <= minWidth) return 0;
    if (this.canvas.width >= maxWidth) return this.canvas.width / 3;

    // Interpolate between 0 and 1/3 of canvas width
    const ratio = (this.canvas.width - minWidth) / (maxWidth - minWidth);
    return ratio * (this.canvas.width / 3);
  }

  // Function to check if a square is within the shape
  private isSquareInShape(xPos: number, yPos: number) {
    const pointsToCheck = [
      // { x: xPos, y: yPos },
      { x: xPos, y: yPos + Shared.squareSize / 2 },
    ];

    for (let point of pointsToCheck) {
      if (this.ctx.isPointInPath(point.x, point.y)) {
        return true;
      }
    }
    return false;
  }

  private drawReferenceShape() {
    this.ctx.beginPath();
    this.ctx.moveTo(this.calculateStartingX(), 0);
    this.ctx.quadraticCurveTo(
      this.cpx,
      this.cpy,
      this.canvas.width,
      this.canvas.height
    );
    this.ctx.lineTo(this.canvas.width, 0);
    this.ctx.closePath();
  }

  // Function to calculate distance to the quadratic curve (approximation)
  private getDistanceToCurve(xPos: number, yPos: number) {
    const minSamplePoints = 50; // Minimum number of sample points to ensure reasonable accuracy
    const maxSamplePoints = 500; // Maximum number of sample points to limit computation
    const samplePoints = Math.min(
      maxSamplePoints,
      Math.max(
        minSamplePoints,
        Math.max(this.canvas.width, this.canvas.height) / 10
      )
    );
    let minDistance = Infinity;

    for (let i = 0; i <= samplePoints; i++) {
      const parameter = i / samplePoints;

      const curveX =
        Math.pow(1 - parameter, 2) * this.calculateStartingX() +
        2 * (1 - parameter) * parameter * this.cpx +
        Math.pow(parameter, 2) * this.canvas.width;
      const curveY =
        Math.pow(1 - parameter, 2) * 0 +
        2 * (1 - parameter) * parameter * this.cpy +
        Math.pow(parameter, 2) * this.canvas.height;

      const distance = Math.sqrt(
        (xPos - curveX) * (xPos - curveX) + (yPos - curveY) * (yPos - curveY)
      );

      if (distance < minDistance) {
        minDistance = distance;
      }
    }

    return minDistance;
  }

  public getFilteredSquares() {
    this.drawReferenceShape();
    const rows = this.canvas.height / Shared.squareSize;
    const cols = this.canvas.width / Shared.squareSize;

    let minDistance = Infinity;
    let maxDistance = -Infinity;
    const filteredSquares: Square[] = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const xPos = col * Shared.squareSize;
        const yPos = row * Shared.squareSize;

        if (this.isSquareInShape(xPos, yPos)) {
          const distance = this.getDistanceToCurve(
            xPos + Shared.squareSize / 2,
            yPos + Shared.squareSize / 2
          );

          if (distance < minDistance) minDistance = distance;
          if (distance > maxDistance) maxDistance = distance;

          filteredSquares.push(
            new Square({
              xPos,
              yPos,
              distance,
              opacity: 0,
              animating: false,
              animationStart: 0,
              firstAnimation: true,
            })
          );
        }
      }
    }

    filteredSquares.forEach((square) => {
      if (typeof square.distance !== "number") return;
      square.distancePercentage = Math.round(
        ((square.distance - minDistance) / (maxDistance - minDistance)) * 100
      );
    });

    this.filteredSquares = filteredSquares;
  }

  public animateSquares(timestamp: DOMHighResTimeStamp) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.filteredSquares.forEach((square) => {
      if (typeof square.distancePercentage !== "number") return;
      const animationFrequency = (1 - square.distancePercentage / 100) * 0.01;

      if (
        !square.animating &&
        ((square.distancePercentage! >= 75 && square.firstAnimation) ||
          (square.distancePercentage! < 75 &&
            Math.random() < animationFrequency))
      ) {
        square.animating = true;
        square.animationStart = timestamp;
      }

      if (square.animating && square.animationStart !== null) {
        const elapsedTime = (timestamp - square.animationStart) / 1000;
        const animationPhase = elapsedTime % 4;

        if (square.firstAnimation) {
          square.opacity = animationPhase / 2; // Only increase opacity to 1 and then stop

          if (animationPhase >= 2) {
            square.animating = false;
            square.firstAnimation = false; // Set to false after first animation
          }
        } else {
          if (animationPhase < 2) {
            // Decrease opacity
            square.opacity = 1 - animationPhase / 2;
          } else {
            // Increase opacity
            square.opacity = (animationPhase - 2) / 2;
          }
          if (elapsedTime >= 4) {
            square.animating = false;
          }
        }
      }

      this.ctx.fillStyle = `rgba(240, 237, 231, ${square.opacity})`;
      this.ctx.fillRect(
        square.xPos,
        square.yPos,
        Shared.squareSize,
        Shared.squareSize
      );
    });
  }
}
