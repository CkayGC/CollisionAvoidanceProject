export interface Vector2D {
  x: number;
  y: number;
}

// Gets distance between two points in 2D space
export function getDistance(position1: Vector2D, position2: Vector2D) {
    const dx = position2.x - position1.x;
    const dy = position2.y - position1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

// Gets the heading from position1 to position2 in degrees
export function getHeadingTowards(position1: Vector2D, position2: Vector2D) {
    const dx = position2.x - position1.x;
    const dy = position2.y - position1.y;
    return Math.atan2(dy, dx) * (180 / Math.PI);
}

// Gets the shortest turn angle from currentHeading to targetHeading in degrees
export function getShortestTurnAngle(currentHeading: number, targetHeading: number) {
    let angleDifference = targetHeading - currentHeading;
    angleDifference = ((angleDifference + 180) % 360) - 180;
    return angleDifference;
}

// Projects a vector from a position in a given direction and distance
export function projectVector(position: Vector2D, heading: number, distance: number): Vector2D { 
    const radianHeading = heading * (Math.PI / 180);
    return {
        x: position.x + distance * Math.cos(radianHeading),
        y: position.y + distance * Math.sin(radianHeading)
    };
}

export function getLinearInterpolation(start: Vector2D, end: Vector2D, t: number): Vector2D {
    return {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t
    };
}