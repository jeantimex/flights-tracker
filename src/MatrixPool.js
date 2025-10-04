import * as THREE from "three";

/**
 * Matrix object pool to reduce garbage collection and improve performance
 * Manages a pool of reusable Matrix4 objects to avoid constant allocation/deallocation
 */
export class MatrixPool {
  constructor(initialSize = 100, maxSize = 1000) {
    this.pool = [];
    this.maxSize = maxSize;
    this.borrowed = new Set(); // Track borrowed matrices for debugging

    // Pre-allocate initial matrices
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(new THREE.Matrix4());
    }
  }

  /**
   * Get a matrix from the pool
   * @returns {THREE.Matrix4} A reusable matrix object
   */
  get() {
    let matrix;

    if (this.pool.length > 0) {
      matrix = this.pool.pop();
    } else {
      // Pool is empty, create new matrix
      matrix = new THREE.Matrix4();
    }

    // Reset matrix to identity
    matrix.identity();

    // Track borrowed matrix for debugging
    if (process.env.NODE_ENV === 'development') {
      this.borrowed.add(matrix);
    }

    return matrix;
  }

  /**
   * Return a matrix to the pool for reuse
   * @param {THREE.Matrix4} matrix - The matrix to return
   */
  release(matrix) {
    if (!matrix) return;

    // Remove from borrowed tracking
    if (process.env.NODE_ENV === 'development') {
      this.borrowed.delete(matrix);
    }

    // Only return to pool if we haven't exceeded max size
    if (this.pool.length < this.maxSize) {
      this.pool.push(matrix);
    }
    // If pool is full, let the matrix be garbage collected
  }

  /**
   * Get a temporary matrix that will be automatically released
   * Use with caution - ensure the matrix isn't used after the callback
   * @param {Function} callback - Function to call with the temporary matrix
   * @returns {*} The result of the callback
   */
  withMatrix(callback) {
    const matrix = this.get();
    try {
      return callback(matrix);
    } finally {
      this.release(matrix);
    }
  }

  /**
   * Get pool statistics for monitoring
   * @returns {Object} Pool statistics
   */
  getStats() {
    return {
      available: this.pool.length,
      borrowed: this.borrowed.size,
      total: this.pool.length + this.borrowed.size,
      maxSize: this.maxSize
    };
  }

  /**
   * Clear the entire pool (useful for cleanup)
   */
  clear() {
    this.pool.length = 0;
    this.borrowed.clear();
  }
}

// Create singleton instance for global use
export const matrixPool = new MatrixPool(200, 2000); // Larger pool for flight tracker

/**
 * Helper function to compose a matrix without creating a new one
 * Updates the matrix in place for better performance
 * @param {THREE.Matrix4} matrix - Matrix to update
 * @param {THREE.Vector3} position - Position vector
 * @param {THREE.Quaternion} quaternion - Rotation quaternion
 * @param {THREE.Vector3} scale - Scale vector
 */
export function composeMatrix(matrix, position, quaternion, scale) {
  const te = matrix.elements;

  const x = quaternion.x, y = quaternion.y, z = quaternion.z, w = quaternion.w;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;

  const sx = scale.x, sy = scale.y, sz = scale.z;

  te[0] = (1 - (yy + zz)) * sx;
  te[1] = (xy + wz) * sx;
  te[2] = (xz - wy) * sx;
  te[3] = 0;

  te[4] = (xy - wz) * sy;
  te[5] = (1 - (xx + zz)) * sy;
  te[6] = (yz + wx) * sy;
  te[7] = 0;

  te[8] = (xz + wy) * sz;
  te[9] = (yz - wx) * sz;
  te[10] = (1 - (xx + yy)) * sz;
  te[11] = 0;

  te[12] = position.x;
  te[13] = position.y;
  te[14] = position.z;
  te[15] = 1;

  return matrix;
}