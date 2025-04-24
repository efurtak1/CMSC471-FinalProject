console.log('D3 Version:', d3.version);

const width = 975;
const height = 610; 

// Asynchronous initialization function
async function init() {
   try {
       // Load geographic (map) data
       const us = await d3.json("./data/states-albers-10m.json");

       // Load mortality data - FIX: Use d3.json instead of d3.csv for JSON data
       const mortality_data = await d3.json("./data/mortality_data.json");
       
       // Verify the loaded data in the console
       console.log('Map data:', us);
       console.log('Mortality data sample:', mortality_data.slice(0, 5));
       
       // Pass loaded data to visualization function
       createVis(us, mortality_data);
   } catch (error) {
       // Catch and report errors clearly
       console.error('Error loading data:', error);
   }
}

// Function to create our visualization - MOVED UP before it's referenced
function createVis(us, mortality_data) {
   // Create a map of state names to data for easier lookup
   const stateDataMap = {};
   
   // Filter for the latest year and specific cause if needed
   // For now, let's just use the first cause type for each state
   mortality_data.forEach(d => {
       // If this state already exists in our map and it's not a newer record, skip
       if (stateDataMap[d.State] && stateDataMap[d.State].Year < d.Year) {
           return;
       }
       // Otherwise add/update the state data
       stateDataMap[d.State] = d;
   });
   
   console.log('State data map:', stateDataMap);
   
   // Get topojson features
   const states_topo = topojson.feature(us, us.objects.states);

   // Match topojson states with our mortality data
   states_topo.features.forEach(s => {
       // Get state name from properties
       const stateName = s.properties.name;
       if (stateDataMap[stateName]) {
           s.properties.state_info = stateDataMap[stateName];
       }
       // Special case for District of Columbia if needed
       else if (stateName === "District of Columbia" && stateDataMap["District of Columbia"]) {
           s.properties.state_info = stateDataMap["District of Columbia"];
       }
   });
   
   // Now create the visualization with the processed data
   createMap(us, states_topo);
}

// Function to actually create the map - separating data processing from visualization
function createMap(us, states_topo) {
   const zoom = d3.zoom()
       .scaleExtent([1, 8])
       .on("zoom", zoomed);

   const svg = d3.select("#vis").append("svg")
       .attr("viewBox", [5, 5, width, height])
       .attr("width", width)
       .attr("height", height)
       .attr("style", "max-width: 100%; height: auto;")
       .on("click", reset);

   // Create tooltip div if it doesn't exist
   if (!d3.select("#tooltip").node()) {
      d3.select("body").append("div")
        .attr("id", "tooltip")
        .attr("class", "tooltip")
        .style("opacity", 0);
   }

   const path = d3.geoPath();
   const g = svg.append("g");

   // Find the range of death rates for proper color scaling
   const allRates = states_topo.features
       .map(d => d.properties.state_info?.["Age-adjusted Death Rate"])
       .filter(rate => rate !== undefined);
   
   const minRate = Math.min(...allRates);
   const maxRate = Math.max(...allRates);
   
   console.log(`Death rates range from ${minRate} to ${maxRate}`);

   // Updated color scale with dynamic domain based on data
   // Changed from white to a very light yellow for better visibility
   const colorScale = d3.scaleLinear()
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
           return rate ? colorScale(rate) : "#E0E0E0"; // Light gray for states with no data
       })
       .on("mouseover", function(event, d) {
          d3.select(this).attr("stroke", "black").attr("stroke-width", 1.5);
          
          const [x, y] = d3.pointer(event, document.body);
          
          d3.select("#tooltip")
              .style("display", 'block')
              .html(`
                  <strong>${d.properties.state_info?.State || d.properties.name}</strong><br/>
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
     
   // Add state names as title (visible on hover in most browsers)
   states.append("title")
       .text(d => d.properties.name);

   // Add state borders - changed from white to gray for better visibility
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

   function clicked(event, d) {
       const [[x0, y0], [x1, y1]] = path.bounds(d);
       event.stopPropagation();
       states.transition().style("fill", null);
       d3.select(this).transition().style("fill", "red");
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
   
   return svg.node();
}

// Trigger data loading and visualization when the window loads
window.addEventListener('load', init);