console.log('D3 Version:', d3.version);

const width = 975;
const height = 610; 

// Asynchronous initialization function
async function init() {
   try {
       // Load geographic (map) data
       us = await d3.json("./data/states-albers-10m.json");

       // Load mortality data
       let mortality_data = await d3.csv("./data/mortality_data.json");
       
       // Verify the loaded data in the console
       console.log('Map data:', us);
       console.log('Mortality data:', mortality_data);
       
       // Pass loaded data to visualization function
       createVis(us, mortality_data);
   } catch (error) {
       // Catch and report errors clearly
       console.error('Error loading data:', error);
   }

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

// Updated color scale: white → orange → red
const colorScale = (x) => {
   if (!x) return "#ccc"; // Gray for missing data
   // Create a 3-point scale: white (low), orange (medium), red (high)
   return d3.scaleLinear()
     .domain([0, 50, 100]) // Adjust these thresholds as needed
     .range(["white", "orange", "red"])(x["Age-adjusted Death Rate"]);
};

const states = g.append("g")
   .attr("cursor", "pointer")
   .selectAll("path")
   .data(topojson.feature(us, us.objects.states).features)
   .join("path")
   .on("click", clicked)
   .attr("d", path)
   .attr("fill", d => colorScale(d.properties.state_info))
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
 
states.append("title")
   .text(d => d.properties.state_info?.state || d.properties.name);

g.append("path")
   .attr("fill", "none")
   .attr("stroke", "white")
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

// Function to create our visualization
function createVis(us, mortality_data) {
   let states_topo = topojson.feature(us, us.objects.states);
   console.log(states_topo);

   // Create a map of state names to data for easier lookup
   const stateDataMap = {};
   mortality_data.forEach(d => {
       stateDataMap[d.state] = d;
   });

   states_topo.features.forEach(s => {
       // Match by state name instead of ID
       const stateName = s.properties.name;
       if (stateDataMap[stateName]) {
           s.properties.state_info = stateDataMap[stateName];
       }
       // Special case for District of Columbia if needed
       else if (stateName === "District of Columbia" && stateDataMap["Washington DC"]) {
           s.properties.state_info = stateDataMap["Washington DC"];
       }
   });
}

// Trigger data loading and visualization when the window loads
window.addEventListener('load', init);