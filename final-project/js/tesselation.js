// clear out anything in the old svg 
let existingSvg = d3.select("svg");
if (!existingSvg.empty()) {
  existingSvg.remove();
}


// Add a title to the visualization
d3.select("body").append("div")
  .attr("class", "visualization-title")
  .html("A₂ Affine Group Tessellation");

// Add legend
const legend = d3.select("body").append("div")
  .attr("class", "visualization-legend")
  .html(`
    <h3 style="margin-top: 0; margin-bottom: 10px;">Legend</h3>
    <div class="legend-item">
      <div class="legend-color" style="background-color: #ff3366;"></div>
      <div>Standard Triangle</div>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background-color: #33aaff;"></div>
      <div>Cluster Triangle</div>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background-color: grey;"></div>
      <div>Fundamental Alcove</div>
    </div>
  `);

// Add zoom indicator
const zoomIndicator = d3.select("body").append("div")
  .attr("class", "zoom-indicator")
  .text("Use mouse wheel to zoom, drag to pan");

  
// define svg 
const svg = d3.select("body")
                .append("svg")
                .attr("width", window.innerWidth)
                .attr("height", window.innerHeight);

const container = svg.append("g");
let classGroups; 
let borderPaths = []; // Store references to border paths

const zoom = d3.zoom()
  .scaleExtent([0.1, 10])
  .on("zoom", (event) => container.attr("transform", event.transform));

svg.call(zoom); // enable zoom 

// Create info panel element for tableau display - make it fixed position for stability
const infoPanel = d3.select("body")
  .append("div")
  .attr("id", "tableauInfo")
  .style("position", "absolute")
  .style("display", "none")
  .style("background", "white")
  .style("padding", "10px")
  .style("border", "1px solid black")
  .style("border-radius", "4px")
  .style("box-shadow", "0 0 10px rgba(0,0,0,0.3)")
  .style("z-index", "1000")
  .style("pointer-events", "none"); // Make it pass-through for mouse events

const config = {
  gridSize: 80,
  colors: {
    default: '#ff3366',
    cluster: '#33aaff',
    fundamental: 'grey'
  }
};

function draw() {
  container.selectAll("*").remove();
  borderPaths = []; // Reset border paths when redrawing

  // make tesselation 
  const width = window.innerWidth;
  const height = window.innerHeight;
  const gridSize = config.gridSize;
  const triangleHeight = gridSize * Math.sqrt(3) / 2;
  const centerX = width/2;
  const centerY = height/2;
  const max = Math.max(width, height);

  const sqrt3 = Math.sqrt(3);

  function axialToPixel(q, r) {
    const x = centerX + gridSize * (q + r / 2);
    const y = centerY + gridSize * sqrt3 / 2 * r;
    return { x, y };
  }

  function getReflectionLineThroughTwoPoints(p1, p2) {
    // Line format: y = m*x + b
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const m = dy / dx;
    const b = p1[1] - m * p1[0];
  
    return { m, b };
  }
  
  function reflectPointAcrossLine(x, y, m, b) {
    // Line in form: y = m*x + b
    const d = (x + (y - b) * m) / (1 + m * m);
    const xR = 2 * d - x;
    const yR = 2 * d * m - y + 2 * b;
  
    return [xR, yR];
  }

  function reflectTriangle(triangle, line) {
    const reflectedPoints = triangle.points.map(([x, y]) =>
      reflectPointAcrossLine(x, y, line.m, line.b)
    );
    const center = triangle.center;
    const reflectedCenter = reflectPointAcrossLine(center.x, center.y, line.m, line.b);
  
    return {
      points: reflectedPoints,
      center: { x: reflectedCenter[0], y: reflectedCenter[1] },
    };
  }
  
  function triangleVertices(q, r, up) {
    const p = axialToPixel(q, r);
    const h = triangleHeight;
    if (up) {
      return [
        [p.x, p.y - h * 2 / 3],
        [p.x - gridSize / 2, p.y + h / 3],
        [p.x + gridSize / 2, p.y + h / 3]
      ];
    } else {
      return [
        [p.x, p.y + h * 2 / 3],
        [p.x - gridSize / 2, p.y - h / 3],
        [p.x + gridSize / 2, p.y - h / 3]
      ];
    }
  }

  const triangles = [];
  const radius = max / gridSize + 2;

  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      const up = (q + r) % 2 === 0;
      const verts = triangleVertices(q, r, up);
      const cx = (verts[0][0] + verts[1][0] + verts[2][0]) / 3;
      const cy = (verts[0][1] + verts[1][1] + verts[2][1]) / 3;

      if (cx < 0 || cy < 0 || cx > width || cy > height) continue;

      triangles.push({
        points: verts,
        center: { x: cx, y: cy },
        id: `tri-${q}-${r}`  // Add a unique ID for each triangle
      });

      container.append("path")
        .attr("d", `M${verts[0][0]},${verts[0][1]} 
                    L${verts[1][0]},${verts[1][1]} 
                    L${verts[2][0]},${verts[2][1]} 
                    Z`)
        .attr("stroke", "black")
        .attr("fill", "none")
        .attr("stroke-width", 1);
    }
  }
  
  // get fundamental alcove 
  const fundamentalAlcove = triangles.reduce((closest, triangle) => {
    const dx = triangle.center.x - centerX;
    const dy = triangle.center.y - centerY;
    const distSq = dx * dx + dy * dy;
    const closestDx = closest.center.x - centerX;
    const closestDy = closest.center.y - centerY;
    const closestDistSq = closestDx * closestDx + closestDy * closestDy;
    return distSq < closestDistSq ? triangle : closest;
  }, triangles[0]);

  const [p1, p2, p3] = fundamentalAlcove.points; 
  const line1 = getReflectionLineThroughTwoPoints(p1, p2);
  const line2 = getReflectionLineThroughTwoPoints(p2, p3);
  const line3 = getReflectionLineThroughTwoPoints(p3, p1);
  let reflectedTriangles = triangles.map(t => reflectTriangle(t, line1));
  reflectedTriangles.push(...triangles.map(t => reflectTriangle(t, line2))); 
  reflectedTriangles.push(...triangles.map(t => reflectTriangle(t, line3))); 

  triangles.push(...reflectedTriangles);
  reflectedTriangles.forEach(tri => {
    const verts = tri.points;
  
    container.append("path")
      .attr("d", `M${verts[0][0]},${verts[0][1]} 
                  L${verts[1][0]},${verts[1][1]} 
                  L${verts[2][0]},${verts[2][1]} 
                  Z`)
      .attr("stroke", "black")
      .attr("fill", "none")
      .attr("stroke-width", 1);
  });

  function compute_basis_vectors(A_0){
    if (A_0.points.length !== 3) {
      throw new Error("Need exactly 3 vertices to define the triangle.");
    }

    let [v0, v1, v2] = A_0.points;
    let cx = A_0.center.x;
    let cy = A_0.center.y;

    const basis1 = [v0[0] - cx, v0[1] - cy];
    const basis2 = [v1[0] - cx, v1[1] - cy];

    return { basis1, basis2 };
  }

  const basis_vectors = compute_basis_vectors(fundamentalAlcove); 
  const { basis1: v1, basis2: v2 } = basis_vectors;
  const center = [fundamentalAlcove.center.x, fundamentalAlcove.center.y];
  const dist = (p1, p2) => Math.hypot(p1[0] - p2[0], p1[1] - p2[1]); // euclidean distance 
  const size = dist(fundamentalAlcove.points[0], fundamentalAlcove.points[1]); // side length 

  const drawn_triangles = []; // Keep track of already drawn triangles

  // Draw a border for fundamental alcove
  container.append("polygon")
    .attr("points", fundamentalAlcove.points.map(p => p.join(",")).join(" "))
    .attr("fill", config.colors.fundamental)
    .attr("stroke", "black")
    .attr("stroke-width", 1);
  
  // Mark the fundamental alcove as drawn and store its unique identifier
  drawn_triangles.push(fundamentalAlcove.center);
  
  // Create a unique identifier for the fundamental alcove
  const fundamentalAlcoveId = `${Math.round(fundamentalAlcove.center.x)}-${Math.round(fundamentalAlcove.center.y)}`;
  drawnTriangles.add(fundamentalAlcoveId);

  // Load data and create controls
  d3.json("data/tableaux_embeddings.json").then(data => {
    classGroups = d3.group(data, d => d.class_id);

    // Remove any existing controls first
    d3.select("#class-buttons").remove();
    
    // Create controls with collapsible functionality
    const controls = d3.select("body")
      .append("div")
      .attr("id", "class-buttons")
      .style("position", "absolute")
      .style("top", "20px")
      .style("left", "20px")
      .style("z-index", "1000")
      .style("background", "rgba(255, 255, 255, 0.9)")
      .style("padding", "10px")
      .style("border", "1px solid black")
      .style("border-radius", "4px")
      .style("max-height", "400px")
      .style("overflow-y", "auto");

    // Add a header bar with collapse button
    const headerBar = controls.append("div")
      .style("display", "flex")
      .style("justify-content", "space-between")
      .style("align-items", "center")
      .style("margin-bottom", "10px")
      .style("cursor", "pointer");
      
    headerBar.append("h3")
      .text("Select Classes to Highlight")
      .style("margin", "0");
      
    const collapseButton = headerBar.append("div")
      .text("▼") // Down arrow for collapse
      .style("font-weight", "bold")
      .style("font-size", "16px");
      
    // Container for the checkboxes that can be shown/hidden
    const checkboxContainer = controls.append("div")
      .attr("id", "checkbox-container");
    
    // Toggle collapse when clicking the header
    let isCollapsed = false;
    headerBar.on("click", function() {
      isCollapsed = !isCollapsed;
      
      if (isCollapsed) {
        checkboxContainer.style("display", "none");
        collapseButton.text("►"); // Right arrow when collapsed
      } else {
        checkboxContainer.style("display", "block");
        collapseButton.text("▼"); // Down arrow when expanded
      }
    });

    // Create checkboxes for each unique class_id (skip duplicates)
    const uniqueClassIds = Array.from(new Set(data.map(d => d.class_id)));
    
    uniqueClassIds.forEach(classId => {
      if (classId !== 0) {  // Skip class_id 0
        const classData = data.find(d => d.class_id === classId);
        const weightVectorStr = JSON.stringify(classData.weight_vector);
        
        const checkbox = checkboxContainer.append("label")
          .attr("class", "checkbox-label")
          .style("display", "block")
          .style("margin-bottom", "5px")
          .text(`${weightVectorStr} `);
        
        checkbox.append("input")
          .attr("type", "checkbox")
          .attr("data-class-id", classId)
          .on("change", function() {
            const classId = +d3.select(this).attr("data-class-id");
            const classItems = data.filter(d => d.class_id === classId);
            
            if (this.checked) {
              classItems.forEach(item => addBorder(item));
            } else {
              classItems.forEach(item => removeBorder(item));
            }
          });
      }
    });

    // Highlight all data points initially
    data.forEach(d => {
      highlightTriangle(d, drawn_triangles);
    });
  });

  // Function to highlight the triangle by adding a border
  function addBorder(dataPoint) {
    const alcove = dataPoint.alcove_coordinates; // [a, b]
    
    const [a, b] = alcove;
    const centerX = center[0] + a * v1[0] + b * v2[0];
    const centerY = center[1] + a * v1[1] + b * v2[1];
  
    // Find triangle corresponding to this point
    const epsilon = 10;
    let targetTriangle = null;
  
    for (const triangle of triangles) {
      const dist = Math.hypot(centerX - triangle.center.x, centerY - triangle.center.y);
      if (dist < epsilon) {
        targetTriangle = triangle;
        break;
      }
    }
  
    if (targetTriangle) {
      // Check if this triangle already has a border
      const existingBorderIndex = borderPaths.findIndex(
        bp => Math.hypot(bp.center.x - targetTriangle.center.x, bp.center.y - targetTriangle.center.y) < epsilon
      );
      
      if (existingBorderIndex === -1) {
        // Create a unique ID for this border
        const borderId = `border-${dataPoint.class_id}-${a}-${b}`;
        
        const borderPath = container.append("path")
          .attr("class", "triangle-border")
          .attr("id", borderId)
          .attr("data-class-id", dataPoint.class_id)
          .attr("d", `M${targetTriangle.points[0][0]},${targetTriangle.points[0][1]} 
                      L${targetTriangle.points[1][0]},${targetTriangle.points[1][1]} 
                      L${targetTriangle.points[2][0]},${targetTriangle.points[2][1]} 
                      Z`)
          .attr("fill", "none")
          .attr("stroke", "#ff3366")
          .attr("stroke-width", 3);

        // Store the reference to the border path with all required data
        borderPaths.push({ 
          center: targetTriangle.center, 
          path: borderPath, 
          classId: dataPoint.class_id,
          alcove: dataPoint.alcove_coordinates
        });
      }
    }
  }
  
  // Function to remove the border
  function removeBorder(dataPoint) {
    const alcove = dataPoint.alcove_coordinates; // [a, b]
    const [a, b] = alcove;
    const centerX = center[0] + a * v1[0] + b * v2[0];
    const centerY = center[1] + a * v1[1] + b * v2[1];
    
    // Find matching borders by class ID and approximate position
    const epsilon = 10;
    
    // Find borders to remove
    const bordersToRemove = borderPaths.filter(bp => {
      const dist = Math.hypot(centerX - bp.center.x, centerY - bp.center.y);
      return bp.classId === dataPoint.class_id && dist < epsilon;
    });
    
    // Remove the borders from the DOM and array
    bordersToRemove.forEach(border => {
      border.path.remove(); // Remove the SVG element
    });
    
    // Update the borderPaths array by removing the deleted borders
    borderPaths = borderPaths.filter(bp => {
      const dist = Math.hypot(centerX - bp.center.x, centerY - bp.center.y);
      return !(bp.classId === dataPoint.class_id && dist < epsilon);
    });
  }

  // Draw points at triangle vertices
  const allVertices = triangles.flatMap(t => t.points);
  const uniqueVertices = Array.from(
    new Set(allVertices.map(p => p.join(",")))
  ).map(str => str.split(",").map(Number));

  container.selectAll(".vertex-dot")
    .data(uniqueVertices)
    .enter()
    .append("circle")
    .attr("class", "vertex-dot")
    .attr("cx", d => d[0])
    .attr("cy", d => d[1])
    .attr("r", 2.5)
    .attr("fill", "#000");

  return { triangles, center, v1, v2 }; // Return important values for reuse
}

// Global tracking variables
let globalTriangles, globalCenter, globalV1, globalV2;
const drawnTriangles = new Set(); // Use a Set for faster lookups

// Initialize the visualization
const { triangles, center, v1, v2 } = draw();
globalTriangles = triangles;
globalCenter = center;
globalV1 = v1;
globalV2 = v2;

function highlightTriangle(dataPoint, drawn_triangles) {
  const alcove = dataPoint.alcove_coordinates; // [a, b]
  
  // Compute alcove's center point using basis vectors
  const [a, b] = alcove;
  const centerX = globalCenter[0] + a * globalV1[0] + b * globalV2[0];
  const centerY = globalCenter[1] + a * globalV1[1] + b * globalV2[1];
  
  // Find triangle corresponding to this point
  const epsilon = 10;
  let triangle = null;
  
  for (const t of globalTriangles) {
    const dist = Math.hypot(centerX - t.center.x, centerY - t.center.y);
    if (dist < epsilon) {
      triangle = t;
      break;
    }
  }
  
  // Create a unique identifier for this triangle
  const triangleId = `${Math.round(centerX)}-${Math.round(centerY)}`;
  
  // Check if we've already drawn this triangle AND it's not the fundamental alcove
  if (triangle && !drawnTriangles.has(triangleId)) {
    // Check if this is the fundamental alcove (which should be at the center)
    const isFundamentalAlcove = Math.hypot(triangle.center.x - globalCenter[0], triangle.center.y - globalCenter[1]) < epsilon;
    
    // If it's the fundamental alcove, don't color it again
    if (!isFundamentalAlcove) {
      // Determine fill color based on data properties
      let color = config.colors.default;
      if (dataPoint.is_cluster) {
        color = config.colors.cluster;
      }
      
      // Draw the triangle
      const triPath = container.append("polygon")
        .attr("points", triangle.points.map(p => p.join(",")).join(" "))
        .attr("fill", color)
        .attr("stroke", "black")
        .attr("opacity", 0.8)
        .attr("stroke-width", 1)
        .attr("data-class-id", dataPoint.class_id)
        .attr("data-triangle-id", triangleId)  // Store triangle ID in DOM
        .style("filter", "none")
        .on("mouseover", function() {
          // Highlight this triangle
          d3.select(this)
            .attr("stroke-width", 2)
            .style("filter", "drop-shadow(0px 0px 6px gray)");
          
          // Show info panel based on the triangle's position, not the mouse position
          showTableauInfo(dataPoint, triangle.center.x, triangle.center.y);
        })
        .on("mouseout", function() {
          // Remove highlight
          d3.select(this)
            .attr("stroke-width", 1)
            .style("filter", "none");
          
          // Hide info panel
          hideTableauInfo();
        });
      
      // Mark this triangle as drawn
      drawnTriangles.add(triangleId);
    }
  }
}

function showTableauInfo(data, x, y) {
  if (!data || !data.tableau) return;

  // Create the tableau table HTML
  const tableauHTML = `
    <table style="border-collapse: collapse; margin-top: 8px;">
      ${data.tableau.map(row => `
        <tr>
          ${row.map(n => `
            <td style="
              border: 1px solid #000;
              width: 30px;
              height: 30px;
              text-align: center;
              vertical-align: middle;
              font-size: 16px;
              font-family: serif;
            ">${n}</td>
          `).join('')}
        </tr>
      `).join('')}
    </table>
  `;

  // Update the info panel content
  infoPanel.html(`
    <div style="margin-bottom: 8px;"><strong>Cluster Variable:</strong> ${data.is_cluster ? 'Yes' : 'No'}</div>
    <div style="margin-bottom: 8px;"><strong>Weight Vector:</strong> ${JSON.stringify(data.weight_vector)}</div>
    <div style="margin-bottom: 4px;"><strong>SSYT:</strong></div>
    ${tableauHTML}
  `);

  // Calculate position - offset to prevent overlapping with the cursor
  // and ensure it stays within viewport bounds
  const padding = 15;
  let posX = x + padding;
  let posY = y;
  
  // Get panel dimensions
  const panelRect = infoPanel.node().getBoundingClientRect();
  const panelWidth = panelRect.width || 200;  // Fallback width if can't get it
  const panelHeight = panelRect.height || 150; // Fallback height
  
  // Check if panel would go off screen and adjust
  if (posX + panelWidth > window.innerWidth) {
    posX = x - panelWidth - padding; // Place on left side of mouse instead
  }
  
  if (posY + panelHeight > window.innerHeight) {
    posY = window.innerHeight - panelHeight - padding; // Prevent going off bottom
  }
  
  // Set the position and show the panel
  infoPanel
    .style("left", `${posX}px`)
    .style("top", `${posY}px`)
    .style("display", "block");
}

// Debounced version of hideTableauInfo to prevent flickering
const hideTableauInfoDebounced = (() => {
  let timeout;
  return function() {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      infoPanel.style("display", "none");
    }, 200); // Small delay to prevent flickering
  };
})();

function hideTableauInfo() {
  hideTableauInfoDebounced();
}

// Resize handler
window.addEventListener('resize', function() {
  // Update SVG dimensions
  svg.attr("width", window.innerWidth)
     .attr("height", window.innerHeight);
  
  // Redraw the visualization
  const { triangles, center, v1, v2 } = draw();
  globalTriangles = triangles;
  globalCenter = center;
  globalV1 = v1;
  globalV2 = v2;
  
  // Clear the drawn triangles set
  drawnTriangles.clear();
});