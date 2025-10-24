
// Warp function
export function applyWarp(v0 = [], controlPoints = []) {

    let W = v0.slice(2);
    let nx = 0;
    let ny = 0;

    // Recreate the points using mean value coordinates
    for (let i = 0; i < controlPoints.length; i++) {
        nx += W[i] * controlPoints[i].x;
        ny += W[i] * controlPoints[i].y;
    }

    //return [nx, ny].concat(W);
    return [nx, ny, ...W];
}



export function getWeight(v0, V = []) {

    let A = [];
    let W = [];
    let L = [];

    let p0 = {x:v0[0], y:v0[1]}


    // Find angles
    for (let i = 0; i < V.length; i++) {
        let j = (i + 1) % V.length;

        let vi = V[i];
        let vj = V[j];

        //console.log(j, vi, vj);

        let r0i = Math.sqrt(
            Math.pow(p0.x - vi.x, 2) + Math.pow(p0.y - vi.y, 2)
        );
        let r0j = Math.sqrt(
            Math.pow(p0.x - vj.x, 2) + Math.pow(p0.y - vj.y, 2)
        );
        let rij = Math.sqrt(
            Math.pow(vi.x - vj.x, 2) + Math.pow(vi.y - vj.y, 2)
        );

        let dn = 2 * r0i * r0j;
        let r = (Math.pow(r0i, 2) + Math.pow(r0j, 2) - Math.pow(rij, 2)) / dn;

        A[i] = isNaN(r) ? 0 : Math.acos(Math.max(-1, Math.min(r, 1)));
    }

    // Find weights
    for (let j = 0; j < V.length; j++) {
        let i = (j > 0 ? j : V.length) - 1;
        let vj = V[j];
        let r = Math.sqrt(Math.pow(vj.x - p0.x, 2) + Math.pow(vj.y - p0.y, 2));
        W[j] = (Math.tan(A[i] / 2) + Math.tan(A[j] / 2)) / r;
    }

    // Normalise weights
    let Ws = W.reduce(function (a, b) {
        return a + b;
    }, 0);
    for (let i = 0; i < V.length; i++) {
        L[i] = W[i] / Ws;
    }

    // Save weights to the point for use when transforming
    let weights = [p0.x, p0.y, ...L];

    return weights;
}


