// Revised Stadium SVG Generator with more distinctive size differences
// This file creates SVG representations of the different stadium sizes
// Save this as stadium-svg-generator.js and run it with Node.js

const fs = require('fs');

// Revised stadium configurations
const stadiumConfigs = [
    {
        id: 'small',
        name: 'Small Stadium',
        width: 700,
        height: 450,
        fenceWidth: 35,
        goalWidth: 70,
        playerRadius: 13,
        ballRadius: 8
    },
    {
        id: 'medium',
        name: 'Medium Stadium',
        width: 1000,
        height: 600,
        fenceWidth: 45,
        goalWidth: 100,
        playerRadius: 15,
        ballRadius: 10
    },
    {
        id: 'large',
        name: 'Large Stadium',
        width: 1300,
        height: 800,
        fenceWidth: 55,
        goalWidth: 130,
        playerRadius: 17,
        ballRadius: 12
    }
];

// Function to generate stadium SVG
function generateStadiumSVG(config) {
    const { width, height, fenceWidth, goalWidth, name, playerRadius, ballRadius } = config;
    const centerX = width / 2;
    const centerY = height / 2;
    const leftFence = fenceWidth;
    const rightFence = width - fenceWidth;
    
    // Center circle size proportional to stadium size
    const circleSizeFactor = width / 1000; // Base the circle size on the stadium width
    const centerCircleRadius = Math.round(60 * circleSizeFactor);
    
    // Create SVG content
    let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <!-- Field background -->
    <rect width="${width}" height="${height}" fill="#1a472a" />
    
    <!-- Field pattern - checkerboard -->
`;

    // Create checkerboard pattern with size relative to stadium size
    const patternSize = Math.round(30 * (width / 1000));
    for (let x = 0; x < width; x += patternSize) {
        for (let y = 0; y < height; y += patternSize) {
            if ((Math.floor(x / patternSize) + Math.floor(y / patternSize)) % 2 === 0) {
                svg += `    <rect x="${x}" y="${y}" width="${patternSize}" height="${patternSize}" fill="#235c37" />
`;
            }
        }
    }

    // Add center line and circle
    svg += `
    <!-- Center line -->
    <line x1="${centerX}" y1="0" x2="${centerX}" y2="${height}" stroke="white" stroke-width="2" />
    
    <!-- Center circle -->
    <circle cx="${centerX}" cy="${centerY}" r="${centerCircleRadius}" stroke="white" stroke-width="2" fill="none" />
    
    <!-- Center spot -->
    <circle cx="${centerX}" cy="${centerY}" r="3" fill="white" />
    
    <!-- Field boundaries -->
    <line x1="${leftFence}" y1="0" x2="${rightFence}" y2="0" stroke="white" stroke-width="2" />
    <line x1="${leftFence}" y1="${height}" x2="${rightFence}" y2="${height}" stroke="white" stroke-width="2" />
    
    <!-- Left fence (excluding goal) -->
    <line x1="${leftFence}" y1="0" x2="${leftFence}" y2="${centerY - goalWidth/2}" stroke="white" stroke-width="2" />
    <line x1="${leftFence}" y1="${centerY + goalWidth/2}" x2="${leftFence}" y2="${height}" stroke="white" stroke-width="2" />
    
    <!-- Right fence (excluding goal) -->
    <line x1="${rightFence}" y1="0" x2="${rightFence}" y2="${centerY - goalWidth/2}" stroke="white" stroke-width="2" />
    <line x1="${rightFence}" y1="${centerY + goalWidth/2}" x2="${rightFence}" y2="${height}" stroke="white" stroke-width="2" />
    
    <!-- Left goal (red) -->
    <path d="M ${leftFence} ${centerY - goalWidth/2} A ${goalWidth/2} ${goalWidth/2} 0 0 0 ${leftFence} ${centerY + goalWidth/2}" stroke="red" stroke-width="3" fill="none" />
    <circle cx="${leftFence}" cy="${centerY - goalWidth/2}" r="4" fill="red" />
    <circle cx="${leftFence}" cy="${centerY + goalWidth/2}" r="4" fill="red" />
    
    <!-- Left goal area -->
    <rect x="0" y="${centerY - goalWidth/2}" width="${leftFence}" height="${goalWidth}" fill="rgba(231, 76, 60, 0.2)" />
    
    <!-- Right goal (blue) -->
    <path d="M ${rightFence} ${centerY - goalWidth/2} A ${goalWidth/2} ${goalWidth/2} 0 0 1 ${rightFence} ${centerY + goalWidth/2}" stroke="blue" stroke-width="3" fill="none" />
    <circle cx="${rightFence}" cy="${centerY - goalWidth/2}" r="4" fill="blue" />
    <circle cx="${rightFence}" cy="${centerY + goalWidth/2}" r="4" fill="blue" />
    
    <!-- Right goal area -->
    <rect x="${rightFence}" y="${centerY - goalWidth/2}" width="${fenceWidth}" height="${goalWidth}" fill="rgba(52, 152, 219, 0.2)" />
    
    <!-- Add stadium size indicator -->
    <text x="${centerX}" y="${20}" text-anchor="middle" fill="white" font-weight="bold" font-size="16">${name}</text>
    <text x="${centerX}" y="${48}" text-anchor="middle" fill="white" font-size="14">${width}×${height}</text>
    
    <!-- Add sample players for scale -->
    <!-- Red team players -->
    <circle cx="${leftFence + width/15}" cy="${centerY - height/8}" r="${playerRadius}" fill="rgba(231, 76, 60, 0.8)" stroke="white" stroke-width="1" />
    <circle cx="${leftFence + width/12}" cy="${centerY + height/8}" r="${playerRadius}" fill="rgba(231, 76, 60, 0.8)" stroke="white" stroke-width="1" />
    <circle cx="${leftFence + width/8}" cy="${centerY}" r="${playerRadius}" fill="rgba(231, 76, 60, 0.8)" stroke="white" stroke-width="1" />
    
    <!-- Blue team players -->
    <circle cx="${rightFence - width/15}" cy="${centerY - height/8}" r="${playerRadius}" fill="rgba(52, 152, 219, 0.8)" stroke="white" stroke-width="1" />
    <circle cx="${rightFence - width/12}" cy="${centerY + height/8}" r="${playerRadius}" fill="rgba(52, 152, 219, 0.8)" stroke="white" stroke-width="1" />
    <circle cx="${rightFence - width/8}" cy="${centerY}" r="${playerRadius}" fill="rgba(52, 152, 219, 0.8)" stroke="white" stroke-width="1" />
    
    <!-- Ball -->
    <circle cx="${centerX}" cy="${centerY}" r="${ballRadius}" fill="white" stroke="#ddd" stroke-width="1" />
</svg>`;

    return svg;
}

// Generate SVG for each stadium size
stadiumConfigs.forEach(config => {
    const svg = generateStadiumSVG(config);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync('./public/images')) {
        fs.mkdirSync('./public/images', { recursive: true });
    }
    
    // Write SVG to file
    fs.writeFileSync(`./public/images/stadium-${config.id}.svg`, svg);
    console.log(`Generated ${config.name} SVG`);
    
    // You can convert SVG to PNG using a library like sharp if needed
    // For now, we'll just use the SVGs directly
});

console.log('All stadium SVGs generated successfully.');
console.log('Place these files in your public/images directory.');