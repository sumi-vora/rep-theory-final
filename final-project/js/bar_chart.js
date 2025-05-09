document.addEventListener('DOMContentLoaded', function() { // error handling 
    // configuration - (to-do: change everything to config. )
    const margin = {top: 50, right: 30, bottom: 180, left: 80};
    let width = 1100 - margin.left - margin.right;
    let height = 600 - margin.top - margin.bottom;
    const colors = { // change to valid and invalid 
        valid: "#33aaff",
        invalid: "#ff3366"
    };
    
    // make the svg 
    const svg = d3.select("#chart")
                  .append("svg")
                  .attr("width", width + margin.left + margin.right)
                  .attr("height", height + margin.top + margin.bottom)
                  .append("g")
                  .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // create tooltip (to-do: change this to info panel class and move this to html file )
    const tooltip = d3.select("body")
                      .append("div")
                      .attr("class", "tooltip")
                      .style("opacity", 0);
    
    // add grid lines
    function addGridLines(yScale) {
        svg.append("g")
           .attr("class", "grid")
           .call(d3.axisLeft(yScale)
                   .tickSize(-width)
                   .tickFormat("")
                );
    }

    // process data 
    function processData(data) {
        return data.map((item) => {
            return {
                id: item.id, 
                weight_vector: item.weight_vector,
                valid_count: item.valid_count,
                invalid_count: item.invalid_count,
                total_count: item.total_count,
                example_tableau_valid: item.example_tableau_valid, 
                example_tableau_invalid: item.example_tableau_invalid
            }
        });
    }
    
    // load and process data
    d3.json("data/equivalence_classes.json").then(function(data) {
        document.getElementById("loading").style.display = "none";
        const equivClasses = processData(data);
        
        // Initial rendering
        let displayData = [...equivClasses]; // copy the original data 
        renderChart(displayData, "stacked");
    }).catch(function(error) {
        console.error("Error loading the data:", error);
        document.getElementById("loading").textContent = "Error loading data";
    });
    
    
    // function to make bar chart 
    function renderChart(data, type) {
        const barWidth = Math.min(40, (width / data.length) - 2);

        const x = d3.scaleBand()
                    .domain(data.map(d => d.id))
                    .range([0, width])
                    .padding(0.2);
        
        const y = d3.scaleLinear()
                    .domain([0, d3.max(data, d => d.total_count)])
                    .nice() // rounds if needed 
                    .range([height, 0]);
        
        addGridLines(y);
        
        // add axes
        const xAxis = svg.append("g")
                         .attr("class", "axis x-axis")
                         .attr("transform", `translate(0,${height})`)
                         // .call(d3.axisBottom(x).tickSizeOuter(0));
        
        svg.append("g")
            .attr("class", "axis y-axis")
            .call(d3.axisLeft(y));
        
        // add axis labels
        svg.append("text")
            .attr("text-anchor", "middle")
            .attr("x", width / 2)
            .attr("y", height + margin.bottom - 110)
            .text("Weight Equivalence Classes")
            .attr("fill", "white")
            .style("color", "white")
            .style("font-size", "14px");
        
        svg.append("text")
            .attr("text-anchor", "middle")
            .attr("transform", "rotate(-90)")
            .attr("y", -margin.left + 20)
            .attr("x", -height / 2)
            .text("Count")
            .attr("fill", "white")
            .style("color", "white")
            .style("font-size", "14px");
        
        // Add title
        // svg.append("text")
        //     .attr("x", width / 2)
        //     .attr("y", -margin.top / 2)
        //     .attr("text-anchor", "middle")
        //     .style("font-size", "18px")
        //     .style("font-weight", "bold")
        //     .style("color", "white")
        //     .text("Distribution of Tableaux Across Equivalence Classes");
        
        if (type == "stacked") {
            renderStackedBars(data, x, y);
        } else {
            renderGroupedBars(data, x, y);
        }
        
        // Add annotations for top classes
        if (data.length <= 20) {
            data.slice(0, 5).forEach(d => {
                svg.append("text")
                    .attr("x", x(d.id) + x.bandwidth() / 2)
                    .attr("y", y(d.total_count) - 10)
                    .attr("text-anchor", "middle")
                    .style("font-size", "12px")
                    .style("fill", "#555")
                    .text(`${d.total_count}`);
            });
        }
    }
    
    // render stacked bars
    function renderStackedBars(data, x, y) {
        const barGroups = svg.selectAll(".bar-group")
        .data(data)
        .enter()
        .append("g")
        .attr("class", "bar-group")
        .attr("transform", d => `translate(${x(d.id)},0)`);

    // Animate each pair (invalid then valid) one after the other
    barGroups.each(function(d, i) {
        const group = d3.select(this);
        const delay = i * 100;  // 100ms delay between each bar

        // Invalid (bottom) bar
        group.append("rect")
            .attr("class", "bar non-cluster-bar")
            .attr("y", y(d.invalid_count))
            .attr("height", height - y(d.invalid_count))
            .attr("width", x.bandwidth())
            .attr("fill", colors.invalid)
            .style("opacity", 0)
            .transition()
            .delay(delay)
            .duration(600)
            .style("opacity", 1);

            group.append("rect")
            .attr("class", "bar cluster-bar")
            .attr("y", y(d.invalid_count)) // Start at top of invalid bar
            .attr("height", 0)             // Start collapsed
            .attr("width", x.bandwidth())
            .attr("fill", colors.valid)
            .transition()
            .delay(delay + 600)            // Stagger after invalid bar
            .duration(600)
            .attr("y", y(d.invalid_count + d.valid_count)) // Move UP to new top
            .attr("height", y(d.invalid_count) - y(d.invalid_count + d.valid_count)); // Grow UP
        });
        // add event listeners for tooltips and info panel
        svg.selectAll(".bar")
            .on("mouseover", function(event, d) {
                const barElement = d3.select(this);
                const isClusterBar = barElement.classed("cluster-bar");
                const parentData = d3.select(this.parentNode).datum();
                
                tooltip.transition()
                    .duration(200)
                    .style("opacity", 1);
                let validExampleHTML = renderTableauHTML(parentData.example_tableau_valid)
                let invalidExampleHTML = renderTableauHTML(parentData.example_tableau_invalid)
                
                let tooltipContent = `
                    <b>Weight Vector:</b> [${parentData.weight_vector.join(", ")}]<br>
                    <b>Num tableaus indexing a cluster variable:</b> ${parentData.valid_count}<br>
                    <b>Num tableaus not indexing a cluster variable:</b> ${parentData.invalid_count}<br>
                    <div style="margin-bottom: 4px;"><strong>Valid Example:</strong></div>
                    ${validExampleHTML}
                    <div style="margin-bottom: 4px;"><strong>Invalid Example:</strong></div>
                    ${invalidExampleHTML}
                `;


                tooltip.html(tooltipContent)
                       .style("left", (event.pageX + 10) + "px")
                       .style("top", (event.pageY - 28) + "px");
                 
                // highlight the bar
                d3.select(this)
                  .transition()
                  .duration(300)
                  .attr("opacity", 0.8)
                  .attr("stroke", "#333")
                  .attr("stroke-width", 2);
            })
            .on("mouseout", function() {
                tooltip.transition()
                       .duration(500)
                       .style("opacity", 0);
                 
                // remove highlight
                d3.select(this)
                  .transition()
                  .duration(300)
                  .attr("opacity", 1)
                  .attr("stroke", "none");
            })
        
    }
                
    function renderTableauHTML(T) {
        return `
        <table style="border-collapse: collapse; margin-top: 8px;">
        ${T.map(row => `
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
        `.trim();
    }             
    
});