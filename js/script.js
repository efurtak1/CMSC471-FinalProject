console.log('D3 Version:', d3.version);

const width = 975;
const height = 610;

// Global variables
let allMortalityData = [];
let currentYear = 2017;
let currentCause = "All causes";
let colorScale;
let usMap;
let dataByYear = {};
let states;
let selectedState = null;

// Asynchronous initialization
async function init() {
    try {
        // Load geographic data
        const us = await d3.json("./data/states-albers-10m.json");
        usMap = us;
        
        // Load mortality data
        allMortalityData = await d3.json("./data/mortality_data.json");

        console.log('Data loaded successfully');

        // Organize mortality data by year and state
        allMortalityData.forEach(d => {
            if (!dataByYear[d.Year]) {
                dataByYear[d.Year] = {};
            }
            dataByYear[d.Year][d.State] = d; // Store the most recent entry per state/year
        });

        // Create controls first
        createYearSlider("#vis1");
        createCauseDropdown(); // This sets currentCause to first available option
        // Then create visualization with default year and cause
        createVis1(us, filterDataByYearAndCause(currentYear, currentCause));

        d3.json("./data/mortality_data.json").then(data => {
            allMortalityData = data;
            createYearSlider_v2("#slider-container", selectedYear => {
                createVis2(allMortalityData, selectedYear);
            });
        
            createVis2(allMortalityData, currentYear);
        });

    } catch (error) {
        console.error('Error loading data:', error);
    }
}

function filterDataByYearAndCause(year, cause) {
    return allMortalityData.filter(d => d.Year === year && d["Cause Name"] === cause);
}

function filterDataByYearAndCause(year, cause) {
    if (cause === "All causes") {
        return allMortalityData.filter(d => d.Year === year);
    }
    return allMortalityData.filter(d => d.Year === year && d["Cause Name"] === cause);
}

function createYearSlider_v2(vis, onYearChange) {
    const years = [...new Set(allMortalityData.map(d => d.Year))].sort((a, b) => a - b);

    const sliderContainer = d3.select(vis)
        .append("div")
        .attr("class", "slider-container")
        .style("width", "100%");

    sliderContainer.append("div")
        .attr("class", "slider-label")
        .text("Select Year");

    const sliderSvg = sliderContainer.append("svg")
        .attr("class", "slider-svg")
        .attr("viewBox", `0 0 ${width} 80`);

    const slider = d3.sliderBottom()
        .min(d3.min(years))
        .max(d3.max(years))
        .step(1)
        .width(width - 60)
        .tickFormat(d3.format("d"))
        .tickValues(years.filter((d, i) => i % 2 === 0))
        .default(currentYear)
        .on("onchange", val => {
            currentYear = val;
            if (onYearChange) onYearChange(currentYear);
        })
        .on("drag", val => {
            currentYear = val;
            if (onYearChange) onYearChange(currentYear);
        });

    const sliderGroup = sliderSvg.append("g")
        .attr("class", "slider-track")
        .attr("transform", `translate(30,40)`);

    sliderGroup.call(slider);

    sliderGroup.selectAll(".tick text")
        .attr("y", 15)
        .style("font-size", "10px")
        .style("text-anchor", "middle");

    sliderGroup.select(".handle")
        .attr("class", "slider-handle");
}

function createYearSlider(vis) {
    const years = [...new Set(allMortalityData.map(d => d.Year))].sort((a, b) => a - b);

    const sliderContainer = d3.select(vis)
        .append("div")
        .attr("class", "slider-container")
        .style("width", "100%");

    sliderContainer.append("div")
        .attr("class", "slider-label")
        .text("Select Year");

    const sliderSvg = sliderContainer.append("svg")
        .attr("class", "slider-svg")
        .attr("viewBox", `0 0 ${width} 80`);

    const slider = d3.sliderBottom()
        .min(d3.min(years))
        .max(d3.max(years))
        .step(1)
        .width(width - 60)
        .tickFormat(d3.format("d"))
        .tickValues(years.filter((d,i) => i % 2 === 0))
        .default(currentYear)
        .on("onchange", val => {
            currentYear = val;
            updateMapForYear(currentYear);
        })
        .on("drag", val => {
            currentYear = val;
            updateMapForYear(currentYear);
        });

    const sliderGroup = sliderSvg.append("g")
        .attr("class", "slider-track")
        .attr("transform", `translate(30,40)`);

    sliderGroup.call(slider);

    sliderGroup.selectAll(".tick text")
        .attr("y", 15)
        .style("font-size", "10px")
        .style("text-anchor", "middle");

    sliderGroup.select(".handle")
        .attr("class", "slider-handle");
}
function createCauseDropdown() {
    // Get unique causes from data
    const causes = [...new Set(allMortalityData.map(d => d["Cause Name"]))].sort();
    
    // Set default cause
    currentCause = causes[0];
    
    // Create container for controls
    const controlsContainer = d3.select("#vis1")
        .append("div")
        .attr("class", "controls-container");
    
    // Left-aligned dropdown container
    const dropdown = controlsContainer.append("div")
        .attr("class", "dropdown-container");
        
    dropdown.append("label")
        .attr("for", "cause-select")
        .text("Select Cause of Death: ")
        .style("margin-right", "10px");
        
    const select = dropdown.append("select")
        .attr("id", "cause-select")
        .on("change", function() {
            currentCause = this.value;
            updateDataForCause(currentCause);
        });
        
    select.selectAll("option")
        .data(causes)
        .enter()
        .append("option")
        .attr("value", d => d)
        .text(d => d);
    
    // Right-aligned legend wrapper
    const legendWrapper = controlsContainer.append("div")
        .attr("class", "legend-wrapper");
    
    // Add color legend
    createColorLegend(legendWrapper);
    
    // Trigger initial update
    updateDataForCause(currentCause);
}

function createColorLegend(container) {
    const legendWidth = 200;
    const legendHeight = 20;
    
    // Add title above the legend
    container.append("div")
        .attr("class", "legend-title")
        .text("Death Rates per 100,000");
    
    // Create SVG for the legend
    const svg = container.append("svg")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .attr("class", "color-legend");
    
    // Add gradient definition
    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
        .attr("id", "legend-gradient")
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0%");
    
    gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#ffebee");
    
    gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#b71c1c");
    
    // Add gradient rectangle
    svg.append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#legend-gradient)");
    
    // Add labels container
    const labels = container.append("div")
        .attr("class", "legend-labels");
    
    // Add min/max labels
    labels.append("span")
        .attr("class", "legend-label")
        .attr("id", "legend-min")
        .text("0");
    
    labels.append("span")
        .attr("class", "legend-label")
        .attr("id", "legend-max")
        .text("0");
}
function updateColorLegend() {
    // Get current data to determine min/max values
    const currentData = filterDataByYearAndCause(currentYear, currentCause);
    const allRates = currentData.map(d => d["Age-adjusted Death Rate"]).filter(rate => rate !== undefined);
    const minRate = allRates.length > 0 ? Math.min(...allRates) : 0;
    const maxRate = allRates.length > 0 ? Math.max(...allRates) : 1;
    
    // Update legend labels with formatted numbers
    d3.select("#legend-min").text(minRate.toFixed(1));
    d3.select("#legend-max").text(maxRate.toFixed(1));
}

function updateDataForCause(cause) {
    // Reorganize data for the selected cause
    const newDataByYear = {};
    
    allMortalityData.forEach(d => {
        if (d["Cause Name"] === cause) {
            if (!newDataByYear[d.Year]) {
                newDataByYear[d.Year] = {};
            }
            newDataByYear[d.Year][d.State] = d;
        }
    });
    
    // Update the global dataByYear reference
    dataByYear = newDataByYear;
    
    // Reattach data to states
    const states_topo = topojson.feature(usMap, usMap.objects.states);
    states_topo.features.forEach(feature => {
        const stateName = feature.properties.name;
        feature.properties.state_info = {};
        
        Object.keys(dataByYear).forEach(year => {
            if (dataByYear[year][stateName]) {
                feature.properties.state_info[year] = dataByYear[year][stateName];
            }
        });
    });
    
    // Recalculate color scale based on current data
    const currentData = filterDataByYearAndCause(currentYear, cause);
    const allRates = currentData.map(d => d["Age-adjusted Death Rate"]).filter(rate => rate !== undefined);
    const minRate = allRates.length > 0 ? Math.min(...allRates) : 0;
    const maxRate = allRates.length > 0 ? Math.max(...allRates) : 1;

    colorScale = d3.scaleLinear()
        .domain([minRate, maxRate])
        .range(["#ffebee", "#b71c1c"]);
    
    // Update the visualization
    updateMapForYear(currentYear);
    updateColorLegend(); // Add this line
}

function updateMapForYear(year) {
    // Get data for current year and cause
    const yearData = filterDataByYearAndCause(year, currentCause);
    
    // Update color scale based on current data
    const allRates = yearData.map(d => d["Age-adjusted Death Rate"]).filter(rate => rate !== undefined);
    const minRate = allRates.length > 0 ? Math.min(...allRates) : 0;
    const maxRate = allRates.length > 0 ? Math.max(...allRates) : 1;

    colorScale = d3.scaleLinear()
        .domain([minRate, maxRate])
        .range(["#ffebee", "#b71c1c"]);
    
    // Update map colors
    if (states) {
        states.transition().duration(500).attr("fill", d => {
            const stateData = d.properties.state_info?.[year];
            return stateData ? colorScale(stateData["Age-adjusted Death Rate"]) : "#E0E0E0";
        });
    }

    // Update selected state info if one is selected
    if (selectedState) {
        const selectedData = d3.select(selectedState).datum().properties.state_info?.[year];
        if (selectedData) {
            d3.select("#deaths-label").text(`Deaths: ${selectedData.Deaths}`);
            d3.select("#rate-label").text(`Rate: ${selectedData["Age-adjusted Death Rate"]?.toFixed(1) || 'N/A'}`);
        } else {
            d3.select("#deaths-label").text("Deaths: N/A");
            d3.select("#rate-label").text("Rate: N/A");
        }
    }
}

function createVis1(us, mortality_data) {
    const states_topo = topojson.feature(us, us.objects.states);

    // Attach data to states
    states_topo.features.forEach(feature => {
        const stateName = feature.properties.name;
        feature.properties.state_info = {};
        
        Object.keys(dataByYear).forEach(year => {
            if (dataByYear[year][stateName]) {
                feature.properties.state_info[year] = dataByYear[year][stateName];
            }
        });
    });

    // Calculate color scale based on current data
    const allRates = mortality_data.map(d => d["Age-adjusted Death Rate"]).filter(rate => rate !== undefined);
    const minRate = allRates.length > 0 ? Math.min(...allRates) : 0;
    const maxRate = allRates.length > 0 ? Math.max(...allRates) : 1;

    colorScale = d3.scaleLinear()
        .domain([minRate, maxRate])
        .range(["#ffebee", "#b71c1c"]);

    createMap(us, states_topo);
}

function createMap(us, states_topo) {
    const zoom = d3.zoom()
        .scaleExtent([1, 8])
        .on("zoom", zoomed);

    const svg = d3.select("#vis1").append("svg")
        .attr("viewBox", [5, 5, width, height])
        .attr("width", width)
        .attr("height", height)
        .attr("style", "max-width: 100%; height: auto;")
        .on("click", reset);

    if (!d3.select("#tooltip").node()) {
        d3.select("body").append("div")
          .attr("id", "tooltip")
          .attr("class", "tooltip")
          .style("opacity", 0);
    }

    const path = d3.geoPath();
    const g = svg.append("g");

    states = g.append("g")
        .attr("cursor", "pointer")
        .selectAll("path")
        .data(states_topo.features)
        .join("path")
        .on("click", clicked)
        .attr("d", path)
        .attr("fill", d => {
            const stateData = d.properties.state_info?.[currentYear];
            return stateData ? colorScale(stateData["Age-adjusted Death Rate"]) : "#E0E0E0";
        })
        .on("mouseover", function(event, d) {
            d3.select(this).attr("stroke", "black").attr("stroke-width", 1.5);
        
            const [x, y] = d3.pointer(event, document.body);
        
            const stateData = d.properties.state_info?.[currentYear];
        
            d3.select("#tooltip")
                .style("display", 'block')
                .html(stateData ? `
                    <strong>${stateData.State}</strong><br/>
                    Year: ${currentYear}<br/>
                    Cause: ${currentCause === "All causes" ? (stateData["Cause Name"] || 'Multiple causes') : currentCause}<br/>
                    Deaths: ${stateData.Deaths?.toLocaleString() || 'N/A'}<br/>
                    Rate: ${stateData["Age-adjusted Death Rate"]?.toFixed(1) || 'N/A'} per 100,000
                ` : `
                    <strong>${d.properties.name}</strong><br/>
                    Year: ${currentYear}<br/>
                    Cause: ${currentCause}<br/>
                    No data available
                `)
                .style("left", `${x + 10}px`)
                .style("top", `${y + 10}px`)
                .style("opacity", 1);
        })
        .on("mouseout", function() {
            d3.select(this).attr("stroke", null);
            d3.select("#tooltip").style("opacity", 0);
        })
        .on("mousemove", function(event) {
            const [x, y] = d3.pointer(event, document.body);
            d3.select("#tooltip")
                .style("left", `${x + 10}px`)
                .style("top", `${y + 10}px`);
        });

    g.append("path")
        .attr("fill", "none")
        .attr("stroke", "#666666")
        .attr("stroke-width", 0.5)
        .attr("stroke-linejoin", "round")
        .attr("d", path(topojson.mesh(us, us.objects.states, (a, b) => a !== b)));

    svg.call(zoom);

    function reset() {
        states.transition().style("fill", d => {
            const stateData = d.properties.state_info?.[currentYear];
            return stateData ? colorScale(stateData["Age-adjusted Death Rate"]) : "#E0E0E0";
        });
        svg.transition().duration(750).call(
            zoom.transform,
            d3.zoomIdentity,
            d3.zoomTransform(svg.node()).invert([width / 2, height / 2])
        );
    }

    function clicked(event, d) {
        event.stopPropagation();

        if (selectedState === this) {
            selectedState = null;
            d3.select(this).transition().style("fill", d => {
                const stateData = d.properties.state_info?.[currentYear];
                return stateData ? colorScale(stateData["Age-adjusted Death Rate"]) : "#E0E0E0";
            });
        } else {
            if (selectedState) {
                d3.select(selectedState).transition().style("fill", d => {
                    const stateData = d.properties.state_info?.[currentYear];
                    return stateData ? colorScale(stateData["Age-adjusted Death Rate"]) : "#E0E0E0";
                });
            }
            selectedState = this;
            d3.select(this).transition().style("fill", "red");
            
            const [[x0, y0], [x1, y1]] = path.bounds(d);
            svg.transition().duration(750).call(
                zoom.transform,
                d3.zoomIdentity
                    .translate(width / 2, height / 2)
                    .scale(Math.min(8, 0.9 / Math.max((x1 - x0) / width, (y1 - y0) / height)))
                    .translate(-(x0 + x1) / 2, -(y0 + y1) / 2),
                d3.pointer(event, svg.node())
            );
        }
    }

    function zoomed(event) {
        const {transform} = event;
        g.attr("transform", transform);
        g.attr("stroke-width", 1 / transform.k);
    }
}

function createVis2(data, year) {
    d3.select("#bubble-chart").selectAll("*").remove();

    const filtered = data.filter(d => +d.Year === year);
    console.log(year)
    // Group by "Cause Name" and sum Deaths across all states
    const grouped = d3.rollups(
        filtered,
        v => d3.sum(v, d => +d.Deaths),
        d => d["Cause Name"]
    );
  
    // Convert to hierarchical format for D3 pack
    const hierarchicalData = {
        children: grouped.map(([name, value]) => ({ name, value }))
    };
  
    // Create packed bubble layout with more padding
    const pack = data => d3.pack()
        .size([width, height * 0.8])
        .padding(5)(
            d3.hierarchy(data)
            .sum(d => d.value * 2)
        );
    const root = pack(hierarchicalData);

    // Color scale
    const color = d3.scaleSequential()
        .domain(d3.extent(grouped, d => Math.log10(d[1] + 1))) 
        .interpolator(d3.interpolateReds);

    const svg = d3.select("#bubble-chart")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("text-anchor", "middle")
        .style("font", "12px sans-serif");

    const g = svg.append("g");
  
    // Add zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.5, 8])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });
    
    svg.call(zoom);

    const initialTransform = d3.zoomIdentity
    .translate(width / 2 - 650 , height / 2 - 700)
    .scale(1.3);

    svg.call(zoom.transform, initialTransform);
    
    // // Create a group for all bubbles
    // const g = svg.append("g");

    const initialY = height * 0.5;

    root.leaves().forEach((d, i) => {
        d.x = width * (0.2 + 0.6 * i / root.leaves().length);
        d.y = initialY + (Math.random() - 0.5) * 30;  // Add slight jitter, keep it higher
        d.vy = 0;  // No downward velocity, so they don't fall initially
    });
  
    // Add force simulation with adjusted parameters
    const simulation = d3.forceSimulation(root.leaves())
        .force("charge", d3.forceManyBody().strength(1))
        .force("x", d3.forceX(width / 2).strength(0.02))
        .force("y", d3.forceY(initialY).strength(0.1))
        .force("collision", d3.forceCollide()
            .radius(d => d.r + 2)
            .strength(0.8)
            .iterations(10)
        )
        .alphaDecay(0.02)
        .velocityDecay(0.4)
        .on("tick", ticked);
  
    const node = g.selectAll("g")
        .data(root.leaves())
        .join("g")
        .attr("transform", d => `translate(${d.x},${d.y})`)
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));
  
    node.append("circle")
        .attr("r", d => d.r)
        .attr("fill", d => color(Math.log10(d.data.value + 1)))
        .attr("stroke", "black")
        .attr("stroke-width", 1)
        .attr("cursor", "pointer")
        .attr("opacity", 0)
        .transition()
        .duration(1000)
        .attr("opacity", 1);
  
    node.append("text")
        .text(d => d.data.name)
        .attr("dy", "0.3em")
        .style("font-size", d => Math.min(2 * d.r / d.data.name.length, 14))
        .attr("pointer-events", "none")
        .attr("opacity", 0)
        .transition()
        .delay(500)
        .duration(800)
        .attr("opacity", 1);

    // Create a dedicated tooltip div if it doesn't exist
    let tooltip = d3.select("#bubble-tooltip");
    if (tooltip.empty()) {
        tooltip = d3.select("body").append("div")
            .attr("id", "bubble-tooltip")
            .attr("class", "tooltip")
            .style("opacity", 0)
            .style("position", "absolute")
            .style("background", "white")
            .style("padding", "8px")
            .style("border", "1px solid #ddd")
            .style("border-radius", "4px")
            .style("pointer-events", "none")
            .style("font-family", "sans-serif")
            .style("font-size", "12px")
            .style("box-shadow", "2px 2px 5px rgba(0,0,0,0.2)");
    }

    const legendWidth = 250;
    const legendHeight = 20;
    const legendMargin = 30;

    const logDomain = d3.extent(grouped, d => Math.log10(d[1] + 1));
    const linearDomain = logDomain.map(v => Math.pow(10, v) - 1); 

    const defs = svg.append("defs");

    const gradient = defs.append("linearGradient")
        .attr("id", "legend-gradient")
        .attr("x1", "0%")
        .attr("x2", "100%")
        .attr("y1", "0%")
        .attr("y2", "0%");

    const steps = 10;
    const interpolator = d3.interpolateReds;

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        gradient.append("stop")
            .attr("offset", `${t * 100}%`)
            .attr("stop-color", interpolator(t));
    }

    const legendGroup = svg.append("g")
        .attr("transform", `translate(${width - legendWidth - legendMargin}, ${legendMargin})`);

    legendGroup.append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#legend-gradient)")
        .attr("stroke", "#aaa")
        .attr("stroke-width", 1);

    legendGroup.append("text")
        .attr("x", 0)
        .attr("y", legendHeight + 20)
        .text(Math.round(linearDomain[0]).toLocaleString())
        .style("font-size", "12px");

    legendGroup.append("text")
        .attr("x", legendWidth)
        .attr("y", legendHeight + 20)
        .attr("text-anchor", "end")
        .text(Math.round(linearDomain[1]).toLocaleString())
        .style("font-size", "12px");

    legendGroup.append("text")
        .attr("x", legendWidth / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .text("Total Deaths");
    
    node.on("mouseover", function(event, d) {
        d3.select(this).raise();
        
        d3.select(this).select("circle")
            .attr("stroke-width", 2)
            .attr("stroke", "white");
        
        tooltip.transition()
            .duration(200)
            .style("opacity", 0.9);
            
        tooltip.html(`
            <div style="margin-bottom: 4px; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 4px;">
                ${d.data.name}
            </div>
            <div style="margin-bottom: 2px;">
                <span style="color: #666">Year:</span> ${year}
            </div>
            <div style="margin-bottom: 2px;">
                <span style="color: #666">Total Deaths:</span> ${d.data.value.toLocaleString()}
            </div>
            <div style="font-size: 11px; color: #999; margin-top: 4px;">
                Click to pin, drag to move
            </div>
        `)
        .style("left", (event.pageX + 15) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function() {
        if (!d3.select(this).classed("pinned")) {
            d3.select(this).select("circle")
                .attr("stroke-width", 1)
                .attr("stroke", "black");
        }
        
        if (!d3.select(this).classed("pinned")) {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        }
    })
    .on("mousemove", function(event) {
        tooltip.style("left", (event.pageX + 15) + "px")
               .style("top", (event.pageY - 28) + "px");
    });

    node.on("click", function(event, d) {
        const isPinned = d3.select(this).classed("pinned");
        d3.select(this).classed("pinned", !isPinned);
        
        node.select("circle")
            .attr("stroke-width", 1)
            .attr("stroke", "black");
        
        if (!isPinned) {
            d3.select(this).select("circle")
                .attr("stroke-width", 3)
                .attr("stroke", "yellow");
            
            tooltip.style("opacity", 0.9);
        } else {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        }
        
        event.stopPropagation(); 
    });

    svg.on("click", function() {
        node.classed("pinned", false)
            .select("circle")
            .attr("stroke-width", 1)
            .attr("stroke", "black");
        
        tooltip.transition()
            .duration(500)
            .style("opacity", 0);
    });

    // const initialY = height * 0.5;

    // root.leaves().forEach((d, i) => {
    //     d.x = width * (0.2 + 0.6 * i / root.leaves().length);
    //     d.y = initialY // Add slight jitter
    //     d.vy = 0;  // No downward velocity
    // });

    // simulation.alpha(0.1).restart();

    // Drag funcstion
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.1).restart();
        d.fx = d.x;
        d.fy = d.y;
    }
    
    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }
    
    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0.02);
        d.fx = null;
        d.fy = null;
    }
    
    function ticked() {
        node.attr("transform", d => `translate(${d.x},${d.y})`);
    }

    // Gradual gravity increase
    setTimeout(() => {
        simulation.force("y", d3.forceY(height * 0.85).strength(0.2));
        simulation.alpha(0.5).restart();
    }, 1500);
}

window.addEventListener('load', init);