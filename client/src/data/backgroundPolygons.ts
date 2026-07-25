import type { PolygonData, Point } from "../types";
const SCALE = 2.5
const scalePoint = (p: Point): Point => ({x: p.x * SCALE, y: p.y * SCALE,});
export const backgroundPolygons: PolygonData[] = 
[
    { id: "noga grzyba",
        depth: 0, 
        points: [ 
                scalePoint({ x: 1130, y: 870 }), 
                scalePoint({ x: 1060, y: 871 }), 
                scalePoint({ x: 1040, y: 823 }), 
                scalePoint({ x: 1111, y: 726 }), 
                scalePoint({ x: 1133, y: 722 }), 
                scalePoint({ x: 1183.5, y: 790 })
                ], 
    }, 
]