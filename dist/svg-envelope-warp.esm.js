const {
    abs, acos, asin, atan, atan2, ceil, cos, exp, floor,
    log, hypot, max, min, pow, random, round, sin, sqrt, tan, PI
} = Math;

// Warp function
function applyWarp(v0 = [], controlPoints = []) {

    let W = v0.slice(2);
    let nx = 0;
    let ny = 0;

    // Recreate the points using mean value coordinates
    for (let i = 0; i < controlPoints.length; i++) {
        nx += W[i] * controlPoints[i].x;
        ny += W[i] * controlPoints[i].y;
    }

    return [nx, ny, ...W];
}

function getWeight(v0, V = []) {

    let A = [];
    let W = [];
    let L = [];

    let p0 = {x:v0[0], y:v0[1]};

    // Find angles
    for (let i = 0; i < V.length; i++) {
        let j = (i + 1) % V.length;

        let vi = V[i];
        let vj = V[j];

        let r0i = sqrt(
            pow(p0.x - vi.x, 2) + pow(p0.y - vi.y, 2)
        );
        let r0j = sqrt(
            pow(p0.x - vj.x, 2) + pow(p0.y - vj.y, 2)
        );
        let rij = sqrt(
            pow(vi.x - vj.x, 2) + pow(vi.y - vj.y, 2)
        );

        let dn = 2 * r0i * r0j;
        let r = (pow(r0i, 2) + pow(r0j, 2) - pow(rij, 2)) / dn;

        A[i] = isNaN(r) ? 0 : acos(max(-1, min(r, 1)));
    }

    // Find weights
    for (let j = 0; j < V.length; j++) {
        let i = (j > 0 ? j : V.length) - 1;
        let vj = V[j];
        let r = sqrt(pow(vj.x - p0.x, 2) + pow(vj.y - p0.y, 2));
        W[j] = (tan(A[i] / 2) + tan(A[j] / 2)) / r;
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

function parsePointAtt(input) {

    let pts = [];

    // is already point array
    let isArray = Array.isArray(input);

    // is nested array – x/y grouped in sub arrays
    let isNested = isArray && input[0].length === 2;

    let isPointArray = isArray && typeof input[0] === 'object' && !isNested;

    // native SVG polygon point lists
    let isSVGPointList = !isPointArray && typeof input === 'object' && [...input].length > 1;
    if (isSVGPointList) {
        input = [...input];
        isPointArray = input[0].constructor.name === 'SVGPoint' ? true : false;
    }

    if (isPointArray) return input;

    if (isNested) {

        pts = input.map((pt) => {
            return { x: pt[0], y: pt[1] };
        });

        return pts
    }

    let isString = typeof input === 'string';
    if (!isString) {
        console.warn("Couldn't parse point input", (typeof input), input);
        return pts;
    }

    // string - sanitize
    input = isString ? input.trim().replace(/[\n|\r|\t]/g, '') : input;

    let isPathData = isString && (input.startsWith('m') || input.startsWith('M'));

    // is json?
    let isJson = input.includes('[') && input.includes('{') && input.includes('x') && input.includes('y');

    if (isPathData) {
        pts = pathData2Poly(input);
        return pts;
    }

    if (isJson) {
        try {
            pts = JSON.parse(input);

        } catch {
            console.warn('no valid point json');
        }
    }
    // is point attribute string
    else {
        pts = input.replaceAll(',', ' ').split(' ')
            .filter(Boolean).map(Number);
        pts = toPointArray(pts);

    }

    pts = cleanUpPoly(pts);

    return pts;
}

function stringifyToPointAtt(pts) {
    return pts.map(pt => { return [pt.x, pt.y].join(' ') }).join(' ');
}

function toPointArray(pts) {
    let ptArr = [];
    for (let i = 1, l = pts.length; i < l; i += 2) {
        ptArr.push({ x: pts[i - 1], y: pts[i] });
    }
    return ptArr;
}

function pathData2Poly(pathdata) {

    let pts = [];
    let isPolygon = /[csqta]/gi.test(pathdata) ? false : true;
    let hasShorthands = /[vh]/gi.test(pathdata) ? true : false;
    let hasRelative = (/[l]/gi.test(pathdata) || pathdata.startsWith('m')) ? true : false;
    const ns = 'http://www.w3.org/2000/svg';

    // sanitize shortened minus
    pathdata = pathdata.replaceAll('-', ' -');

    // strip M and L
    if (isPolygon && !hasRelative && !hasShorthands) {
        pathdata = pathdata.replace(/[M|L]/g, ' ');
        let ptsArr = pathdata.replaceAll(',', ' ').split(' ')
            .filter(Boolean).map(Number);

        for (let i = 1, l = ptsArr.length; i < l; i += 2) {
            pts.push({ x: ptsArr[i - 1], y: ptsArr[i] });
        }

    }
    // create temporary path to parse
    else {

        let svgTmp = document.createElementNS(ns, 'svg');
        let path = document.createElementNS(ns, 'path');
        path.setAttribute('d', pathdata);
        svgTmp.append(path);

        let warp = new Warp(svgTmp);
        let threshold = isPolygon ? Infinity : 3;
        warp.interpolate(threshold);

        let pathDataArr = warp.paths;
        pathDataArr.forEach(path => {
            let pathData = path.pathData;
            let commands = pathData.map(com => { return { x: com.x, y: com.y } });
            pts.push(...commands);
        });
    }

    // remove coinciding points

    return cleanUpPoly(pts)
}

function cleanUpPoly(pts) {

    let remove = [];
    pts.forEach((pt, i) => {
        let indexPrev = i > 0 ? i - 1 : pts.length - 1;
        let pt0 = pts[indexPrev];
        if (pt.x === pt0.x && pt0.y === pt.y) {
            remove.push(indexPrev);
        }
    });

    remove.forEach(r => {
        pts.splice(r, 1);
    });

    return pts

}

function normalizePoly(pts, width = 100, height = 100, fitToHull = false, autoViewBox = false, bbSVG = { x: 0, y: 0, width: 0, height: 0 }, padding = 0) {
    if (!pts || pts.length < 3) return pts;

    // Clone
    let ptsCopy = JSON.parse(JSON.stringify(pts));

    if (fitToHull && bbSVG.width) {
        width = bbSVG.width;
        height = bbSVG.height;
    }

    // Compute envelope bounding box 
    let bb = getPolyBBox(pts);
    let scaleX = width / (bb.width);
    let scaleY = height / (bb.height);

    let translateX = bb.x;
    let translateY = bb.y;

    if (fitToHull) {
        // uniform scaling – keep aspect ratio
        let scale = max(scaleX, scaleY);
        scaleX = scaleY = scale;
    }

    // change starting point and drawing direction
    let area = getPolygonArea(ptsCopy, false);
    let isCW = area > 0 ? true : false;
    if (!isCW) ptsCopy = ptsCopy.reverse();

    ptsCopy = sortPolygonTopLeftFirst(ptsCopy, bb);

    // Move to origin and scale
    ptsCopy = ptsCopy.map(pt => ({
        x: (pt.x - translateX) * scaleX,
        y: (pt.y - translateY) * scaleY
    }));

    // Recompute bounding box after scaling
    let scaledBB = getPolyBBox(ptsCopy);

    // Center polygon within target viewBox
    let offsetX = (width - scaledBB.width) / 2 - scaledBB.x;
    let offsetY = (height - scaledBB.height) / 2 - scaledBB.y;

    if (fitToHull && bbSVG.width) {
        offsetX += bbSVG.x;
        offsetY += bbSVG.y;
    }

    if (fitToHull && autoViewBox) {
        offsetX -= bbSVG.x;
        offsetY -= bbSVG.y;
        bbSVG.x = 0;
        bbSVG.y = 0;
    }

    ptsCopy = ptsCopy.map(pt => ({
        x: pt.x + offsetX,
        y: pt.y + offsetY
    }));

    // get rectangular projection if needed
    scaledBB = getPolyBBox(ptsCopy);

    // add padding to rectangular hull
    if (padding) {
        bbSVG.x -= padding;
        bbSVG.y -= padding;
        bbSVG.width += padding * 2;
        bbSVG.height += padding * 2;
    }

    let polyRect = fitToHull && bbSVG.width ? getRectangularPoly(ptsCopy, bbSVG) : getRectangularPoly(ptsCopy, scaledBB);

    // add mid point for mesh test

    return { bb: scaledBB, rect: polyRect, poly: ptsCopy };
    
}

function getRectangularPoly(pts, bb) {
    if (!pts || pts.length < 4) return [];

    const n = pts.length;
    const landscape = bb.width >= bb.height;

    // base count per side
    const base = floor(n / 4);
    let rem = n - base * 4;

    // corner points
    const TL = { x: bb.x, y: bb.y };
    const TR = { x: bb.x + bb.width, y: bb.y };
    const BR = { x: bb.x + bb.width, y: bb.y + bb.height };
    const BL = { x: bb.x, y: bb.y + bb.height };

    // distribute remaining vertices
    let topN = base;
    let rightN = base;
    let bottomN = base;
    let leftN = base;

    if (landscape) {
        bottomN += rem; // landscape: stretch bottom edge
    } else {
        rightN += rem; // portrait: stretch right edge
    }

    const rectPts = [];

    // helper to interpolate evenly along an edge (exclude last corner)
    const edge = (from, to, count) => {
        const pts = [];
        for (let i = 0; i < count; i++) {
            const t = i / count;
            pts.push({
                x: from.x + (to.x - from.x) * t,
                y: from.y + (to.y - from.y) * t,
            });
        }
        return pts;
    };

    // Build clockwise: top, right, bottom, left
    rectPts.push(...edge(TL, TR, topN));
    rectPts.push(...edge(TR, BR, rightN));
    rectPts.push(...edge(BR, BL, bottomN));
    rectPts.push(...edge(BL, TL, leftN));

    // Adjust vertex count in case of rounding
    if (rectPts.length > n) rectPts.length = n;

    return rectPts;
}

function getPolygonArea(pts, absolute = true) {
    let area = 0;
    for (let i = 0, len = pts.length; len && i < len; i++) {
        let ptN = pts[i === len - 1 ? 0 : i + 1];
        let addX = pts[i].x;
        let addY = ptN.y;
        let subX = ptN.x;
        let subY = pts[i].y;
        area += addX * addY * 0.5 - subX * subY * 0.5;
    }
    return absolute ? abs(area) : area;
}

function getPolyBBox(vertices) {
    let xArr = vertices.map(pt => pt.x);
    let yArr = vertices.map(pt => pt.y);
    let left = min(...xArr);
    let right = max(...xArr);
    let top = min(...yArr);
    let bottom = max(...yArr);
    let bb = {
        x: left,
        left: left,
        right: right,
        y: top,
        top: top,
        bottom: bottom,
        width: right - left,
        height: bottom - top
    };

    return bb;
}

function getSquareDistance(p1, p2) {
    return (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2
}

function sortPolygonTopLeftFirst(pts, bb) {
    if (!pts || pts.length === 0) return pts;

    if (!bb) bb = getPolyBBox(pts);
    let ptCorner = { x: bb.left, y: bb.top };

    let firstIndex = 0;
    let minDist = Infinity;

    for (let i = 0; i < pts.length; i++) {
        let dist = getSquareDistance(pts[i], ptCorner);
        if (dist < minDist) {
            minDist = dist;
            firstIndex = i;
        }
    }

    return pts.slice(firstIndex).concat(pts.slice(0, firstIndex));
}

function warpSVG(svg, envelope = '', options = {}) {

    if (!envelope) return false

    options = {
        ... {
            fitToHull: false,
            threshold: 1000,
            autoViewBox: false,
            resetHull:false,
            viewBox: { x: 0, y: 0, width: 0, height: 0 },
            hullPadding:0,
        },
        ...options
    };

    if (!options.viewBox.width) {
        options.autoViewBox = true;
    }

    let { viewBox, fitToHull, autoViewBox, resetHull, threshold, hullPadding } = options;

    if (typeof viewBox === 'string') {
        viewBox = viewBox.split(/[,| ]/).filter(Boolean).map(Number);
    }

    if (Array.isArray(viewBox)) {
        viewBox = {
            x: viewBox[0],
            y: viewBox[1],
            width: viewBox[1],
            height: viewBox[2]
        };
    }

    const ns = 'http://www.w3.org/2000/svg';
    let type = typeof svg;
    let isString = type === 'string';
    let isPathData = isString && (svg.startsWith('M') || svg.startsWith('m'));

    // create temporary SVG if input is pathData
    if (isPathData) {
        let svgTmp = document.createElementNS(ns, 'svg');
        let path = document.createElementNS(ns, 'path');
        path.setAttribute('d', svg);

        svgTmp.append(path);

        document.body.append(svgTmp);
        svg = svgTmp;

        if (!viewBox.width) {
            viewBox = svg.getBBox();
            console.log(viewBox);
            options.autoViewBox = true;
        }

        svg.setAttribute('viewBox', [viewBox.x, viewBox.y, viewBox.width, viewBox.height].join(' '));

    }

    // init warp.js
    let warp = new Warp(svg);
    warp.envelope(envelope, options);

}

Warp.prototype.envelope = function (envelope = '',
    {
        fitToHull = false,
        threshold = 1000,
        autoViewBox = false,
        hullPadding=0,
        resetHull=false,
    } = {}
) {

    if (!envelope) return false

    let svg = this.element;
    let bb = svg.getBBox();
    let hasViewBox = svg.getAttribute('viewBox');

    // center elements according to x/y min
    if (autoViewBox) {

        bb.width = bb.x * 2 + bb.width;
        bb.height = bb.y * 2 + bb.height;
    }

    let viewBox = hasViewBox && !autoViewBox ? svg.viewBox.baseVal : bb;
    let { x, y, width, height } = viewBox;

    if (!hasViewBox) {
        width += x * 2;
        height += y * 2;
    }

    // adjust viewBox
    let vB = [0, 0, width, height].map(val => +val.toFixed(0));
    if (autoViewBox) {
        svg.setAttribute('viewBox', vB.join(' '));
    }

    let hullPts = parsePointAtt(envelope);

    /**
     * normalize hull poly
     * create rectangular eenvelope hull
     * and scaled envelope poly to match 
     * target svg viewBox
     */

    // generate rectangular hull and scaled poly for measuring
    let polyNormData = normalizePoly(hullPts, width, height, fitToHull, autoViewBox, bb, hullPadding);
    let { rect, poly } = polyNormData;

    // take detransformed rectangular polygon for weight measuring
    let controlPointsInit = rect;

    // hull polygon
    let controlPoints = resetHull ? rect : poly;

    // Compute weights from control points
    this.transform((v0) => getWeight(v0, controlPointsInit));

    // higher threshold values produce lesser commands - more compact paths
    this.interpolate(threshold);

    // apply warp
    this.transform((v0) => applyWarp(v0, controlPoints));

    function getPathData(svg){
        let d='';
        let paths = svg.querySelectorAll('path');
        paths.forEach(path=>{
            d+=path.getAttribute('d');
        });
        return d
    }

    this.getViewBox = () => vB;
    this.getRect = () => rect;
    this.getPoly = () => controlPoints;
    this.getSVG = () => new XMLSerializer().serializeToString(svg);
    this.getPathData = () => getPathData(svg);

    return this

};

// Browser global
if (typeof window !== 'undefined') {
    window.stringifyToPointAtt = stringifyToPointAtt;
    window.applyWarp = applyWarp;
    window.warpSVG = warpSVG;

}

export { PI, abs, acos, applyWarp, asin, atan, atan2, ceil, cos, exp, floor, hypot, log, max, min, pow, random, round, sin, sqrt, stringifyToPointAtt, tan, warpSVG };
