export function depthToFill(depth: number): string {
    switch(depth) {
        case 0:
            return "#635b5b";
        case 1:
            return "#635b5bc0"; 
        case 2:
            return "#635b5b9d"; 
        case 3:
            return "#746b6b75";
        case 4:
            return "#635b5b38";
        default:
            return "#635b5b";  
        }   

}