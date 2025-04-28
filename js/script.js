console.log('D3 Version:', d3.version);

const width = 975;
const height = 610;

// Global variables
let allMortalityData = [];
let currentYear = 2017;
let colorScale;
let usMap; // Store map reference
let dataByYear = {}; // NEW: to store data organized by year
let states; // Need to declare globally for updateMapForYear
let selectedState = null; // Also global

// Asynchronous initialization
async function init() {
    try {
        // Load geographic data
        const us = await d3.json("./data/states-albers-10m.json");
        usMap = us; // Store for later use
        
        // Load mortality data
        allMortalityData = await d3.json("./data/mortality_data.json");

        console.log('Data loaded successfully');

        // Organize mortality data by year and state for quick lookup
        allMortalityData.forEach(d => {
            if (!dataByYear[d.Year]) {
                dataByYear[d.Year] = {};
            }
            dataByYear[d.Year][d.State] = d;
        });

        // Create year slider first
        createYearSlider();
        
        // Then create visualization with default year
        createVis(us, filterDataByYear(currentYear));
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

function filterDataByYear(year) {
    return allMortalityData.filter(d => d.Year === year);
}

function createYearSlider() {
    const years = [...new Set(allMortalityData.map(d => d.Year))].sort((a, b) => a - b);

    const sliderContainer = d3.select("#vis1")
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
function updateMapForYear(year) {
    // Keep the same color scale (don't recalculate for each year)
    // This ensures consistent coloring across years
    
    // Update map colors based on the selected year
    states.transition().duration(500).attr("fill", d => {
        const stateData = d.properties.state_info?.[year];
        return stateData ? colorScale(stateData["Age-adjusted Death Rate"]) : "#E0E0E0";
    });

    // Update tooltip info if a state is selected
    if (selectedState) {
        const selectedData = d3.select(selectedState).datum().properties.state_info?.[year];
        if (selectedData) {
            d3.select("#deaths-label").text(`Deaths: ${selectedData.Deaths}`);
            d3.select("#rate-label").text(`Rate of Deaths: ${selectedData["Age-adjusted Death Rate"]}`);
        } else {
            d3.select("#deaths-label").text("Deaths: N/A");
            d3.select("#rate-label").text("Rate of Deaths: N/A");
        }
    }
}
function createVis(us, mortality_data) {
    const states_topo = topojson.feature(us, us.objects.states);

    // Match topojson states with our mortality data (like in working version)
    states_topo.features.forEach(feature => {
        const stateName = feature.properties.name;
        feature.properties.state_info = {};
        
        // Add data for all years to each state feature
        Object.keys(dataByYear).forEach(year => {
            if (dataByYear[year][stateName]) {
                feature.properties.state_info[year] = dataByYear[year][stateName];
            }
        });
    });

    // Calculate color scale based on ALL data (not just current year)
    const allRates = allMortalityData.map(d => d["Age-adjusted Death Rate"]).filter(rate => rate !== undefined);
    const minRate = Math.min(...allRates);
    const maxRate = Math.max(...allRates);

    colorScale = d3.scaleLinear()
        .domain([minRate, maxRate])  // Simpler two-point scale
        .range(["#ffebee", "#b71c1c"]);  // Light red to dark red

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
    // ... rest of your event handlers ...
        .on("mouseover", function(event, d) {
            d3.select(this).attr("stroke", "black").attr("stroke-width", 1.5);
        
            const [x, y] = d3.pointer(event, document.body);
        
            const stateData = d.properties.state_info?.[currentYear];
        
            d3.select("#tooltip")
                .style("display", 'block')
                .html(stateData ? `
                    <strong>${stateData.State}</strong><br/>
                    Year: ${currentYear}<br/>
                    ${stateData["Cause Name"] || 'No cause listed'}<br/>
                    Deaths: ${stateData.Deaths?.toLocaleString() || 'N/A'}<br/>
                    Rate: ${stateData["Age-adjusted Death Rate"]?.toFixed(1) || 'N/A'} per 100,000
                ` : `
                    <strong>${d.properties.name}</strong><br/>
                    Year: ${currentYear}<br/>
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
            const stateData = dataByYear[currentYear][d.properties.name];
            return stateData ? colorScale(stateData["Age-adjusted Death Rate"]) : "#ccc";
        });
        svg.transition().duration(750).call(
            zoom.transform,
            d3.zoomIdentity,
            d3.zoomTransform(svg.node()).invert([width / 2, height / 2])
        );
    }

    function clicked(event, d) {
        event.stopPropagation();

        if (selectedState === d) {
            selectedState = null;
        } else {
            selectedState = d;
        }

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

    function zoomed(event) {
        const {transform} = event;
        g.attr("transform", transform);
        g.attr("stroke-width", 1 / transform.k);
    }
}

window.addEventListener('load', init);
