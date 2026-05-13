// ===================================
// CORE MATH CLASSES FOR GAME DEVELOPMENT
// Bug-fixed and optimized
// ===================================

/**
 * 2D Vector Class
 * Used for positions, velocities, directions, and forces
 */
class Vector2D {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    // Addition - modifies this vector
    add(other) {
        this.x += other.x;
        this.y += other.y;
        return this;
    }

    // Subtraction - returns new vector (consistent with mathematical convention)
    subtract(other) {
        return new Vector2D(this.x - other.x, this.y - other.y);
    }

    // Static method for subtraction without creating intermediate objects
    static subtract(a, b) {
        return new Vector2D(a.x - b.x, a.y - b.y);
    }

    // Multiplication by scalar - modifies this vector
    multiply(scalar) {
        this.x *= scalar;
        this.y *= scalar;
        return this;
    }

    // Division by scalar - modifies this vector
    divide(scalar) {
        if (scalar !== 0) {
            this.x /= scalar;
            this.y /= scalar;
        } else {
            console.warn('Vector2D: Division by zero');
        }
        return this;
    }

    // Get the length (magnitude) of the vector
    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    // Get squared length (faster, no sqrt)
    lengthSquared() {
        return this.x * this.x + this.y * this.y;
    }

    // Calculate distance to another vector
    distance(other) {
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Calculate squared distance (faster, no sqrt)
    distanceSquared(other) {
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        return dx * dx + dy * dy;
    }

    // Normalize - make length = 1
    normalize() {
        const len = this.length();
        if (len > 0) {
            this.x /= len;
            this.y /= len;
        }
        return this;
    }

    // Create a copy of this vector
    copy() {
        return new Vector2D(this.x, this.y);
    }

    // Dot product
    dot(other) {
        return this.x * other.x + this.y * other.y;
    }

    // Cross product (returns scalar in 2D)
    cross(other) {
        return this.x * other.y - this.y * other.x;
    }

    // Linear interpolation
    lerp(target, t) {
        this.x += (target.x - this.x) * t;
        this.y += (target.y - this.y) * t;
        return this;
    }

    // Rotate by angle (in radians)
    rotate(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const newX = this.x * cos - this.y * sin;
        const newY = this.x * sin + this.y * cos;
        this.x = newX;
        this.y = newY;
        return this;
    }

    // Get angle of vector
    angle() {
        return Math.atan2(this.y, this.x);
    }

    // Limit the length to max
    limit(max) {
        const lenSq = this.lengthSquared();
        if (lenSq > max * max) {
            this.normalize();
            this.multiply(max);
        }
        return this;
    }

    // Set length to specific value
    setLength(len) {
        this.normalize();
        this.multiply(len);
        return this;
    }

    // Set the vector values
    set(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }

    // Get perpendicular vector (rotated 90 degrees)
    perpendicular() {
        return new Vector2D(-this.y, this.x);
    }

    // Project this vector onto another vector
    project(onto) {
        const dotProduct = this.dot(onto);
        const ontoLengthSq = onto.lengthSquared();

        if (ontoLengthSq === 0) return new Vector2D(0, 0);

        const scalar = dotProduct / ontoLengthSq;
        return new Vector2D(
            onto.x * scalar,
            onto.y * scalar
        );
    }

    // Reflect this vector across a surface normal
    reflect(normal) {
        const dot = this.dot(normal);
        return new Vector2D(
            this.x - 2 * dot * normal.x,
            this.y - 2 * dot * normal.y
        );
    }

    // Static method to create from angle and length
    static fromAngle(angle, length = 1) {
        return new Vector2D(
            Math.cos(angle) * length,
            Math.sin(angle) * length
        );
    }

    // Static method to get random vector
    static random(length = 1) {
        const angle = Math.random() * Math.PI * 2;
        return Vector2D.fromAngle(angle, length);
    }

    // Static method for linear interpolation
    static lerp(start, end, t) {
        return new Vector2D(
            start.x + (end.x - start.x) * t,
            start.y + (end.y - start.y) * t
        );
    }
}

/**
 * 2D Matrix Class
 * Used for transformations (rotation, scale, translation)
 * FIXED: scale() method now correctly applies scaling
 */
class Matrix2D {
    constructor() {
        // Matrix format:
        // | a  b  tx |
        // | c  d  ty |
        // | 0  0  1  |
        this.a = 1; this.b = 0; this.tx = 0;
        this.c = 0; this.d = 1; this.ty = 0;
    }

    // Rotate by angle (in radians)
    rotate(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const a = this.a * cos - this.c * sin;
        const c = this.a * sin + this.c * cos;
        const b = this.b * cos - this.d * sin;
        const d = this.b * sin + this.d * cos;
        this.a = a; this.b = b;
        this.c = c; this.d = d;
        return this;
    }

    // Scale by sx and sy
    // FIXED: Previously had bug where b and c were scaled incorrectly
    scale(sx, sy) {
        this.a *= sx;
        this.b *= sx;
        this.c *= sy;
        this.d *= sy;
        return this;
    }

    // Translate by tx and ty
    translate(tx, ty) {
        this.tx += tx;
        this.ty += ty;
        return this;
    }

    // Transform a point using this matrix
    transformPoint(point) {
        return new Vector2D(
            point.x * this.a + point.y * this.b + this.tx,
            point.x * this.c + point.y * this.d + this.ty
        );
    }

    // Reset to identity matrix
    identity() {
        this.a = 1; this.b = 0; this.tx = 0;
        this.c = 0; this.d = 1; this.ty = 0;
        return this;
    }

    // Create a copy of this matrix
    copy() {
        const m = new Matrix2D();
        m.a = this.a; m.b = this.b; m.tx = this.tx;
        m.c = this.c; m.d = this.d; m.ty = this.ty;
        return m;
    }
}

/**
 * Helper function to draw a vector arrow on canvas
 */
function drawVector(ctx, start, end, color = '#4fc3f7', width = 2) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;

    // Draw line
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    // Draw arrowhead
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const headLength = 10;

    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
        end.x - headLength * Math.cos(angle - Math.PI / 6),
        end.y - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
        end.x - headLength * Math.cos(angle + Math.PI / 6),
        end.y - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
}

/**
 * Helper function to draw a grid on canvas
 */
function drawGrid(ctx, width, height, gridSize = 50, color = '#2a2f4a') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x <= width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y <= height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
}

/**
 * Helper function to clear canvas
 */
function clearCanvas(ctx, width, height, bgColor = '#0d1117') {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
}

/**
 * Linear interpolation between two values
 */
function lerp(start, end, t) {
    return start + (end - start) * t;
}

/**
 * Clamp value between min and max
 */
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Map value from one range to another
 */
function map(value, inMin, inMax, outMin, outMax) {
    return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

/**
 * Random integer between min and max (inclusive)
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Random float between min and max
 */
function randomFloat(min, max) {
    return Math.random() * (max - min) + min;
}

/**
 * Line-line intersection
 * Returns intersection point or null if lines don't intersect
 */
function lineIntersection(p1, p2, p3, p4) {
    const x1 = p1.x, y1 = p1.y;
    const x2 = p2.x, y2 = p2.y;
    const x3 = p3.x, y3 = p3.y;
    const x4 = p4.x, y4 = p4.y;

    const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

    if (Math.abs(denominator) < 0.0001) {
        return null; // Lines are parallel
    }

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return new Vector2D(
            x1 + t * (x2 - x1),
            y1 + t * (y2 - y1)
        );
    }

    return null;
}

/**
 * Check if line intersects with rectangle
 * Returns true if the line segment from p1 to p2 intersects the rectangle
 */
function lineIntersectsRect(p1, p2, rect) {
    // Rectangle edges
    const topLeft = new Vector2D(rect.x, rect.y);
    const topRight = new Vector2D(rect.x + rect.width, rect.y);
    const bottomLeft = new Vector2D(rect.x, rect.y + rect.height);
    const bottomRight = new Vector2D(rect.x + rect.width, rect.y + rect.height);

    // Check intersection with all four edges
    if (lineIntersection(p1, p2, topLeft, topRight)) return true;
    if (lineIntersection(p1, p2, topRight, bottomRight)) return true;
    if (lineIntersection(p1, p2, bottomRight, bottomLeft)) return true;
    if (lineIntersection(p1, p2, bottomLeft, topLeft)) return true;

    return false;
}

// ===================================
// DEMO CONTROLLER UTILITIES
// ===================================

/**
 * Creates a controller that pauses/resumes animation when canvas is off-screen
 * This helps save CPU cycles by not animating demos that aren't visible
 *
 * Usage:
 *   const controller = createDemoController(canvas, animateFn);
 *   // Later, if needed: controller.stop();
 *
 * @param {HTMLCanvasElement} canvas - The canvas element to observe
 * @param {Function} animateFn - The animation loop function (will be called with requestAnimationFrame)
 * @param {Object} options - Optional configuration
 * @returns {Object} Controller with stop() method
 */
function createDemoController(canvas, animateFn, options = {}) {
    const { threshold = 0.1, autoStart = true } = options;
    let animationId = null;
    let isRunning = false;

    function start() {
        if (!isRunning) {
            isRunning = true;
            animationId = requestAnimationFrame(animateFn);
        }
    }

    function stop() {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        isRunning = false;
    }

    // Use IntersectionObserver to pause off-screen demos
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    start();
                } else {
                    stop();
                }
            });
        }, { threshold });

        observer.observe(canvas);
    } else if (autoStart) {
        // Fallback for browsers without IntersectionObserver
        start();
    }

    return {
        start,
        stop,
        isRunning: () => isRunning
    };
}

// ===================================
// ISOMETRIC HELPERS
// Used by the Isometric Strategy game-tutorial track.
// Diamond (2:1) projection — tileW is the on-screen width, tileH the on-screen height.
// Convention: cart coords (cx, cy) index the tile grid; screen coords (sx, sy) are pixels.
// originX / originY is the screen pixel for tile (0, 0).
// ===================================

/**
 * Convert cartesian (tile-grid) coordinates to screen pixels.
 * Diamond projection: each step in cx moves (+tileW/2, +tileH/2);
 *                     each step in cy moves (-tileW/2, +tileH/2).
 * @param {number} cx Tile x (can be fractional for smooth movement)
 * @param {number} cy Tile y
 * @param {number} tileW Tile width in pixels (typical: 64)
 * @param {number} tileH Tile height in pixels (typical: 32 for a 2:1 diamond)
 * @param {number} originX Screen pixel x corresponding to tile (0, 0)
 * @param {number} originY Screen pixel y corresponding to tile (0, 0)
 * @returns {{x:number,y:number}} Screen pixel position
 */
function cartToIso(cx, cy, tileW, tileH, originX = 0, originY = 0) {
    return {
        x: originX + (cx - cy) * (tileW / 2),
        y: originY + (cx + cy) * (tileH / 2)
    };
}

/**
 * Inverse of cartToIso — convert screen pixels back to fractional tile coordinates.
 * Floor the result to get the integer tile under a mouse cursor.
 * @param {number} sx Screen pixel x
 * @param {number} sy Screen pixel y
 * @param {number} tileW Tile width in pixels
 * @param {number} tileH Tile height in pixels
 * @param {number} originX Screen pixel x corresponding to tile (0, 0)
 * @param {number} originY Screen pixel y corresponding to tile (0, 0)
 * @returns {{x:number,y:number}} Fractional tile coordinates
 */
function isoToCart(sx, sy, tileW, tileH, originX = 0, originY = 0) {
    const dx = sx - originX;
    const dy = sy - originY;
    // Derivation: from cartToIso, dx = (cx - cy) * tileW/2, dy = (cx + cy) * tileH/2.
    // Solving the system: cx = dx/tileW + dy/tileH, cy = dy/tileH - dx/tileW.
    return {
        x: dx / tileW + dy / tileH,
        y: dy / tileH - dx / tileW
    };
}

/**
 * Draw a single isometric (diamond) tile centered on the given screen position.
 * The screen position is the *top* of the diamond, matching the cartToIso output for
 * the tile's logical top-corner.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} sx Screen x of the diamond's top vertex
 * @param {number} sy Screen y of the diamond's top vertex
 * @param {number} tileW Tile width in pixels
 * @param {number} tileH Tile height in pixels
 * @param {string} fillStyle Fill color, or null to skip
 * @param {string} strokeStyle Outline color, or null to skip
 */
function drawIsoTile(ctx, sx, sy, tileW, tileH, fillStyle = '#3a4a6a', strokeStyle = '#4fc3f7') {
    const halfW = tileW / 2;
    const halfH = tileH / 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);                  // top
    ctx.lineTo(sx + halfW, sy + halfH);  // right
    ctx.lineTo(sx, sy + tileH);          // bottom
    ctx.lineTo(sx - halfW, sy + halfH);  // left
    ctx.closePath();
    if (fillStyle) {
        ctx.fillStyle = fillStyle;
        ctx.fill();
    }
    if (strokeStyle) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

/**
 * Full mouse → integer tile-coordinate pipeline.
 * Returns {x, y} clamped to integers (the tile the mouse is hovering).
 * If mapW / mapH are provided, returns null for out-of-bounds picks.
 * @param {number} mouseX Mouse x relative to the canvas
 * @param {number} mouseY Mouse y relative to the canvas
 * @param {number} originX Tile-(0,0) screen x
 * @param {number} originY Tile-(0,0) screen y
 * @param {number} tileW
 * @param {number} tileH
 * @param {number} [mapW] Optional grid width for bounds-check
 * @param {number} [mapH] Optional grid height for bounds-check
 * @returns {{x:number,y:number}|null}
 */
function pickTileFromMouse(mouseX, mouseY, originX, originY, tileW, tileH, mapW = null, mapH = null) {
    // The cartToIso math places the top vertex of tile (cx, cy) at originY + (cx+cy)*tileH/2.
    // For mouse-picking we want the tile whose diamond *contains* the mouse — that means
    // offsetting Y by tileH/2 so we measure from the diamond's center, not its top vertex.
    const cart = isoToCart(mouseX, mouseY - tileH / 2, tileW, tileH, originX, originY);
    const tx = Math.floor(cart.x);
    const ty = Math.floor(cart.y);
    if (mapW !== null && (tx < 0 || tx >= mapW)) return null;
    if (mapH !== null && (ty < 0 || ty >= mapH)) return null;
    return { x: tx, y: ty };
}
