export function getSegmentImportance(name: string): "primary" | "secondary" {
    const n = name.toLowerCase();

    if (n.includes("main") || n.includes("pdst")) {
        return "primary";
    }

    return "secondary";
}

export function importanceToStyle(level: "primary" | "secondary") {
    switch (level) {
        case "primary":
            return {
                stroke: "#1f1f1fa9",      // prawie czarny #1f1f1f
                width: 4,
                opacity: 0.8,
                dasharray: undefined,   // linia ciągła
            };

        case "secondary":
            return {
                stroke: "#1f1f1f79",      // jasna szarość #9A9A9A
                width: 2,
                opacity: 0.75,
                dasharray: "30 8",       // linia przerywana
            };
    }
}


