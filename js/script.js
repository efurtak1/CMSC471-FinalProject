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

        createYearSlider("#slider-container");
        d3.json("./data/mortality_data.json").then(data => {
            createVis2(allMortalityData, currentYear);
        })

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
  
    // Step 2: Group by "Cause Name" and sum Deaths across all states
    const grouped = d3.rollups(
      filtered,
      v => d3.sum(v, d => +d.Deaths),
      d => d["Cause Name"]
    );
  
    // Step 3: Convert to hierarchical format for D3 pack
    const hierarchicalData = {
      children: grouped.map(([name, value]) => ({ name, value }))
    };
  
    // Step 4: Create packed bubble layout
    const pack = data => d3.pack()
    .size([width, height])
    .padding(2)(
      d3.hierarchy(data)
        .sum(d => d.value * 2) // <— increase bubble size multiplier
    );
    const root = pack(hierarchicalData);

    console.log(root.leaves())

    // const color = d3.scaleOrdinal(d3.schemeCategory10);

    const color = d3.scaleSequential()
    .domain(d3.extent(grouped, d => Math.log10(d[1] + 1))) 
    .interpolator(d3.interpolateReds);

    const svg = d3.select("#bubble-chart")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height])
    .attr("text-anchor", "middle")
    .style("font", "12px sans-serif");
  
    const node = svg.selectAll("g")
      .data(root.leaves())
      .join("g")
      .attr("transform", d => `translate(${d.x},${d.y})`);
  
    node.append("circle")
    .attr("r", d => d.r * 1.2)
    .attr("fill", d => color(Math.log10(d.data.value + 1)))
    .attr("stroke", "black")
    .attr("stroke-width", 1);
  
    node.append("text")
      .text(d => d.data.name)
      .attr("dy", "0.3em")
      .style("font-size", d => Math.min(2 * d.r / d.data.name.length, 14));

    node.on("click", (event, d) => {
        alert(`Cause: ${d.data.name}\nDeaths: ${d.data.value}`);
        // Or console.log(d); to inspect the full data object
      });

    const tooltip = d3.select("#tooltip");

    node.on("mouseover", (event, d) => {
        tooltip.transition()
          .duration(200)
          .style("opacity", 0.9);
        tooltip.html(`<strong>${d.data.name}</strong><br/>Deaths: ${d.data.value.toLocaleString()}`)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mousemove", (event) => {
        tooltip
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", () => {
        tooltip.transition()
          .duration(500)
          .style("opacity", 0);
      });
}

window.addEventListener('load', init);