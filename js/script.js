console.log('D3 Version:', d3.version);

const width = 975;
const height = 610;

// Global variables
let allMortalityData = [];
let currentYear = 2017;
let colorScale;
let usMap; // Store map reference

// Asynchronous initialization
async function init() {
   try {
       // Load geographic data
       const us = await d3.json("./data/states-albers-10m.json");
       usMap = us; // Store for later use
       
       // Load mortality data
       allMortalityData = await d3.json("./data/mortality_data.json");
       
       console.log('Data loaded successfully');
       
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
    
    // Create container with proper dimensions
    const sliderContainer = d3.select("#vis1")
        .append("div")
        .attr("class", "slider-container")
        .style("width", "100%");
    
    // Add label
    sliderContainer.append("div")
        .attr("class", "slider-label")
        .text("Select Year");
    
    // Create SVG with proper dimensions and class
    const sliderSvg = sliderContainer.append("svg")
        .attr("class", "slider-svg")
        .attr("viewBox", `0 0 ${width} 80`); // Width matches your visualization
    
    // Create slider with adjusted margins
    const slider = d3.sliderBottom()
        .min(d3.min(years))
        .max(d3.max(years))
        .step(1)
        .width(width - 60) // Reduced width to accommodate ticks
        .tickFormat(d3.format("d"))
        .tickValues(years.filter((d,i) => i % 2 === 0)) // Show every other year if too crowded
        .default(currentYear)
        .on("onchange", val => {
            currentYear = val;
            updateMapForYear(currentYear);
        });
    
    // Add slider group with proper class
    const sliderGroup = sliderSvg.append("g")
        .attr("class", "slider-track")
        .attr("transform", `translate(30,40)`); // Centered vertically
    
    // Apply the slider
    sliderGroup.call(slider);
    
    // Adjust tick text positioning if needed
    sliderGroup.selectAll(".tick text")
        .attr("y", 15)
        .style("font-size", "10px")
        .style("text-anchor", "middle");
    
    // Adjust handle position if needed
    sliderGroup.select(".handle")
        .attr("class", "slider-handle");
}

function updateMapForYear(year) {
    const yearData = filterDataByYear(year);
    const stateDataMap = {};
    
    yearData.forEach(d => {
        if (!stateDataMap[d.State] || stateDataMap[d.State].Year < d.Year) {
            stateDataMap[d.State] = d;
        }
    });
    
    // Update the map colors
    d3.select("#vis1 svg g")
        .selectAll("path")
        .attr("fill", d => {
            const stateName = d.properties.name;
            const stateData = stateDataMap[stateName];
            const rate = stateData?.["Age-adjusted Death Rate"];
            return rate ? colorScale(rate) : "#E0E0E0";
        });
    
    // Update tooltip data
    d3.select("#vis1 svg g")
        .selectAll("path")
        .on("mouseover", function(event, d) {
            const stateName = d.properties.name;
            const stateData = stateDataMap[stateName];
            
            d3.select(this).attr("stroke", "black").attr("stroke-width", 1.5);
            
            const [x, y] = d3.pointer(event, document.body);
            
            d3.select("#tooltip")
                .style("display", 'block')
                .html(`
                    <strong>${stateData?.State || stateName}</strong><br/>
                    Year: ${year}<br/>
                    ${stateData?.["Cause Name"] || 'No data available'}<br/>
                    Deaths: ${stateData?.Deaths?.toLocaleString() || 'N/A'}<br/>
                    Rate: ${stateData?.["Age-adjusted Death Rate"]?.toFixed(1) || 'N/A'} per 100,000
                `)
                .style("left", `${x + 10}px`)
                .style("top", `${y + 10}px`)
                .style("opacity", 1);
        });
}

function createVis(us, mortality_data) {
   // Create state data map
   const stateDataMap = {};
   
   mortality_data.forEach(d => {
       if (!stateDataMap[d.State] || stateDataMap[d.State].Year < d.Year) {
           stateDataMap[d.State] = d;
       }
   });
   
   // Get topojson features
   const states_topo = topojson.feature(us, us.objects.states);

   // Match states with mortality data
   states_topo.features.forEach(s => {
       const stateName = s.properties.name;
       if (stateDataMap[stateName]) {
           s.properties.state_info = stateDataMap[stateName];
       }
       else if (stateName === "District of Columbia" && stateDataMap["District of Columbia"]) {
           s.properties.state_info = stateDataMap["District of Columbia"];
       }
   });
   
   // Create the visualization
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

   // Create tooltip if it doesn't exist
   if (!d3.select("#tooltip").node()) {
      d3.select("body").append("div")
        .attr("id", "tooltip")
        .attr("class", "tooltip")
        .style("opacity", 0);
   }

   const path = d3.geoPath();
   const g = svg.append("g");

   // Calculate rate range for color scale
   const allRates = states_topo.features
       .map(d => d.properties.state_info?.["Age-adjusted Death Rate"])
       .filter(rate => rate !== undefined);
   
   const minRate = Math.min(...allRates);
   const maxRate = Math.max(...allRates);
   
   // Create color scale
   colorScale = d3.scaleLinear()
       .domain([minRate, (minRate + maxRate) / 2, maxRate])
       .range(["#FFF8E1", "orange", "red"]);

   // Draw states
   const states = g.append("g")
       .attr("cursor", "pointer")
       .selectAll("path")
       .data(states_topo.features)
       .join("path")
       .on("click", clicked)
       .attr("d", path)
       .attr("fill", d => {
           const rate = d.properties.state_info?.["Age-adjusted Death Rate"];
           return rate ? colorScale(rate) : "#E0E0E0";
       })
       .on("mouseover", function(event, d) {
          d3.select(this).attr("stroke", "black").attr("stroke-width", 1.5);
          
          const [x, y] = d3.pointer(event, document.body);
          
          d3.select("#tooltip")
              .style("display", 'block')
              .html(`
                  <strong>${d.properties.state_info?.State || d.properties.name}</strong><br/>
                  Year: ${currentYear}<br/>
                  ${d.properties.state_info?.["Cause Name"] || 'No data available'}<br/>
                  Deaths: ${d.properties.state_info?.Deaths?.toLocaleString() || 'N/A'}<br/>
                  Rate: ${d.properties.state_info?.["Age-adjusted Death Rate"]?.toFixed(1) || 'N/A'} per 100,000
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
     
   // Add state borders
   g.append("path")
       .attr("fill", "none")
       .attr("stroke", "#666666")
       .attr("stroke-width", 0.5)
       .attr("stroke-linejoin", "round")
       .attr("d", path(topojson.mesh(us, us.objects.states, (a, b) => a !== b)));

   svg.call(zoom);

   function reset() {
       states.transition().style("fill", null);
       svg.transition().duration(750).call(
          zoom.transform,
          d3.zoomIdentity,
          d3.zoomTransform(svg.node()).invert([width / 2, height / 2])
       );
   }

   let selectedState = null;

   function clicked(event, d) {
       event.stopPropagation();
       
       if (selectedState === this) {
           d3.select(this).transition().style("fill", null);
           selectedState = null;
       } else {
           states.transition().style("fill", null);
           d3.select(this).transition().style("fill", "red");
           selectedState = this;
           
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

window.addEventListener('load', init);