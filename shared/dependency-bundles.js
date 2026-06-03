// ===================================
// DEPENDENCY BUNDLES FOR EXPORT FEATURE
// Stores reusable code as strings for standalone HTML generation
// ===================================

const DEPENDENCY_BUNDLES = {
    vector2d: `
class Vector2D {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    add(other) {
        this.x += other.x;
        this.y += other.y;
        return this;
    }

    subtract(other) {
        return new Vector2D(this.x - other.x, this.y - other.y);
    }

    static subtract(a, b) {
        return new Vector2D(a.x - b.x, a.y - b.y);
    }

    multiply(scalar) {
        this.x *= scalar;
        this.y *= scalar;
        return this;
    }

    divide(scalar) {
        if (scalar !== 0) {
            this.x /= scalar;
            this.y /= scalar;
        } else {
            console.warn('Vector2D: Division by zero');
        }
        return this;
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    lengthSquared() {
        return this.x * this.x + this.y * this.y;
    }

    distance(other) {
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    distanceSquared(other) {
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        return dx * dx + dy * dy;
    }

    normalize() {
        const len = this.length();
        if (len > 0) {
            this.x /= len;
            this.y /= len;
        }
        return this;
    }

    copy() {
        return new Vector2D(this.x, this.y);
    }

    dot(other) {
        return this.x * other.x + this.y * other.y;
    }

    cross(other) {
        return this.x * other.y - this.y * other.x;
    }

    lerp(target, t) {
        this.x += (target.x - this.x) * t;
        this.y += (target.y - this.y) * t;
        return this;
    }

    rotate(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const newX = this.x * cos - this.y * sin;
        const newY = this.x * sin + this.y * cos;
        this.x = newX;
        this.y = newY;
        return this;
    }

    angle() {
        return Math.atan2(this.y, this.x);
    }

    limit(max) {
        const lenSq = this.lengthSquared();
        if (lenSq > max * max) {
            this.normalize();
            this.multiply(max);
        }
        return this;
    }

    setLength(len) {
        this.normalize();
        this.multiply(len);
        return this;
    }

    set(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }

    perpendicular() {
        return new Vector2D(-this.y, this.x);
    }

    project(onto) {
        const dotProduct = this.dot(onto);
        const ontoLengthSq = onto.lengthSquared();
        if (ontoLengthSq === 0) return new Vector2D(0, 0);
        const scalar = dotProduct / ontoLengthSq;
        return new Vector2D(onto.x * scalar, onto.y * scalar);
    }

    reflect(normal) {
        const dot = this.dot(normal);
        return new Vector2D(
            this.x - 2 * dot * normal.x,
            this.y - 2 * dot * normal.y
        );
    }

    static fromAngle(angle, length = 1) {
        return new Vector2D(
            Math.cos(angle) * length,
            Math.sin(angle) * length
        );
    }

    static random(length = 1) {
        const angle = Math.random() * Math.PI * 2;
        return Vector2D.fromAngle(angle, length);
    }

    static lerp(start, end, t) {
        return new Vector2D(
            start.x + (end.x - start.x) * t,
            start.y + (end.y - start.y) * t
        );
    }
}`,

    clearCanvas: `
function clearCanvas(ctx, width, height, color = '#0d1117') {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
}`,

    drawGrid: `
function drawGrid(ctx, width, height, gridSize = 50, color = '#2a2f4a') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    for (let y = 0; y <= height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
}`,

    randomFloat: `
function randomFloat(min, max) {
    return Math.random() * (max - min) + min;
}`,

    randomInt: `
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}`,

    lerp: `
function lerp(start, end, t) {
    return start + (end - start) * t;
}`,

    clamp: `
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}`,

    map: `
function map(value, inMin, inMax, outMin, outMax) {
    return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}`,

    drawVector: `
function drawVector(ctx, start, end, color = '#4fc3f7', width = 2) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

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
}`,

    matrix2d: `
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

    // Transform a point using this matrix (returns a new Vector2D)
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
}`
};
