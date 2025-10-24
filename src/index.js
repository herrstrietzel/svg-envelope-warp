export {
    abs, acos, asin, atan, atan2, ceil, cos, exp, floor, hypot,
    log, max, min, pow, random, round, sin, sqrt, tan, PI
} from './constants';


import { applyWarp, getWeight } from './warp_helpers';
import { parsePointAtt, normalizePoly, stringifyToPointAtt } from './poly_helpers';


export function warpSVG(svg, envelope = '', options = {}) {

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
        options.autoViewBox = true
    }

    let { viewBox, fitToHull, autoViewBox, resetHull, threshold, hullPadding } = options;


    if (typeof viewBox === 'string') {
        viewBox = viewBox.split(/[,| ]/).filter(Boolean).map(Number)
    }

    if (Array.isArray(viewBox)) {
        viewBox = {
            x: viewBox[0],
            y: viewBox[1],
            width: viewBox[1],
            height: viewBox[2]
        }
    }

    const ns = 'http://www.w3.org/2000/svg';
    let type = typeof svg;
    let isString = type === 'string'
    let isPathData = isString && (svg.startsWith('M') || svg.startsWith('m'))

    // create temporary SVG if input is pathData
    if (isPathData) {
        let svgTmp = document.createElementNS(ns, 'svg')
        let path = document.createElementNS(ns, 'path')
        path.setAttribute('d', svg)

        svgTmp.append(path)
        //svgTmp.style.cssText = 'width:0; height:0; opacity:0; position:absolute;'

        document.body.append(svgTmp);
        svg = svgTmp

        //|| !options.autoViewBox
        if (!viewBox.width) {
            viewBox = svg.getBBox()
            console.log(viewBox);
            options.autoViewBox = true
        }

        svg.setAttribute('viewBox', [viewBox.x, viewBox.y, viewBox.width, viewBox.height].join(' '))

    }

    //console.log(options, type);

    // init warp.js
    let warp = new Warp(svg);
    let envelopeWarp = warp.envelope(envelope, options)
    //let svgW = envelopeWarp.getSVG()
    //let path = envelopeWarp.getPathData()
    //console.log(path);


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
        //let padding = (Math.abs(bb.x) + Math.abs(bb.y))/2

        bb.width = bb.x * 2 + bb.width;
        bb.height = bb.y * 2 + bb.height;
    }

    let viewBox = hasViewBox && !autoViewBox ? svg.viewBox.baseVal : bb;
    let { x, y, width, height } = viewBox;


    if (!hasViewBox) {
        width += x * 2
        height += y * 2
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
    let polyNormData = normalizePoly(hullPts, width, height, fitToHull, autoViewBox, bb, hullPadding)
    let { rect, poly } = polyNormData;


    // take detransformed rectangular polygon for weight measuring
    let controlPointsInit = rect

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
        let paths = svg.querySelectorAll('path')
        paths.forEach(path=>{
            d+=path.getAttribute('d')
        })
        return d
    }

    this.getViewBox = () => vB;
    this.getRect = () => rect;
    this.getPoly = () => controlPoints;
    this.getSVG = () => new XMLSerializer().serializeToString(svg);
    this.getPathData = () => getPathData(svg);

    return this

}


// Browser global
if (typeof window !== 'undefined') {
    window.stringifyToPointAtt = stringifyToPointAtt;
    window.applyWarp = applyWarp;
    window.warpSVG = warpSVG;
    //window.normalizePointInput = normalizePointInput;
}

export { stringifyToPointAtt as stringifyToPointAtt }
export { applyWarp as applyWarp }