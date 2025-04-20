console.log('D3 Version:', d3.version);

// your script.js
const margin = { top: 40, right: 40, bottom: 40, left: 60 };
const width = 700
const height = 700

const svg = d3.select('#vis')
   .append('svg')
   .attr('width', width)
   .attr('height', height)
   .append('g')
    // we use a square canvas 
   .attr('transform', `translate(${width / 2},${height / 2})`)

svg.append('text')
   .attr('x', 0)
   .attr('y', -height / 2 + margin.top)
   .text('new (old) covid-19 cases in the usa')
   .style('fill', '#555555')
   .style('font-size', 16) 
   .style("font-weight", 600)
   .style('text-anchor', 'middle')
   .style('text-transform', 'uppercase')

svg.append('text')
   .attr('x',   0)
   .attr('y',  -height / 2  + margin.top + 20)
   .text('color picked for aesthethics and might not be truthful')
   .style('fill', '#888888')
   .style('font-size', 12) 
   .style('text-anchor', 'middle')
   .style("font-weight", 400)


const spiralArc = (fromRadius, toRadius, width, fromAngle, toAngle) => {
   const x1 = fromRadius * Math.sin(fromAngle);
   const y1 = fromRadius * -Math.cos(fromAngle);
   const x2 = (fromRadius + width) * Math.sin(fromAngle);
   const y2 = (fromRadius + width) * -Math.cos(fromAngle);
   const x3 = toRadius * Math.sin(toAngle);
   const y3 = toRadius * -Math.cos(toAngle);
   const x4 = (toRadius + width) * Math.sin(toAngle);
   const y4 = (toRadius + width) * -Math.cos(toAngle);
   return `
     M ${x1},${y1} 
     L ${x2},${y2} 
     A ${fromRadius},${fromRadius} 1 0 1 ${x4},${y4} 
     L ${x3},${y3}
     A ${fromRadius},${fromRadius} 0 0 0 ${x1},${y1}`;
};

// The main function that builds the visualization
// We pass the dataset as a parameter
function createVis(data) {
   const BASE_RADIUS = 30;  
   const OFFSET = .25     
   const angle = Math.PI * 2 / 365; 

   let caseScale = d3.scaleLinear([1, d3.max(data.map(d => d.newConfirmed))], [1, 150])
   let colorScale = d3.scaleSequential(d3.interpolateReds)
    .domain([0, d3.max(data.map(d => d.newConfirmed))]);
   const formatYear = d3.timeFormat("%Y")
   const formatMonth = d3.timeFormat("%b")    // 'Jan', 'Feb', 'Mar', ...

    // Add legend to top-right corner
    const legend = svg.append('g')
      .attr('class', 'legend')
     .attr('transform', `translate(${width/2 - 120}, ${-height/2 + 40})`);  // Top-right position

    // Legend data - adjust these thresholds based on your data
    const legendThresholds = [100000, 250000, 500000, 1000000];
    
    legend.append('text')
      .attr('x', 0)
      .attr('y', 0)
      .text('Daily Cases')
      .style('font-size', 12)
      .style('font-weight', 500)
      .style('fill', '#555');

    const legendHeight = 100;
    const legendWidth = 20;
    
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'legend-gradient')
      .attr('x1', '0%')
      .attr('x2', '0%')
      .attr('y1', '100%')  
      .attr('y2', '0%');    

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', colorScale(0));
    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', colorScale(d3.max(legendThresholds)));

    legend.append('rect')
      .attr('x', 0)
      .attr('y', 20)
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .style('fill', 'url(#legend-gradient)')
      .style('stroke', '#999');

    legend.selectAll('.legend-tick')
      .data(legendThresholds)
      .enter().append('g')
      .attr('class', 'legend-tick')
      .attr('transform', d => `translate(0, ${20 + legendHeight - (d/d3.max(legendThresholds)) * legendHeight})`)
      .each(function(d) {
         const g = d3.select(this);
         // tick mark
         g.append('line')
            .attr('x1', legendWidth)
            .attr('x2', legendWidth + 5)
            .attr('stroke', '#000')
            .attr('stroke-width', 1);
            // label
         g.append('text')
            .attr('x', legendWidth + 10)
            .attr('dy', '0.35em')
            .text(d >= 1000000 ? `${d/1000000}M` : `${d/1000}K`)
            .style('font-size', '10px')
            .style('fill', '#333');
      });

   for (let index = 0; index < data.length; index++) {
       const height = caseScale(data[index].newConfirmed)
       const fromAngle = angle * index;
       const toAngle = angle * (index + 1);
       const fromRadius = toRadius = BASE_RADIUS +  OFFSET * index - height / 2;

       if (data[index].date.getDate() === 12 && data[index].date.getMonth() === 0) {
         let yearRadius = fromRadius
         // Offset to align the first day in a month
         let yearAngle = fromAngle - angle * 12  
         svg.append('g')
            .attr("transform", `translate(${Math.sin(yearAngle) * yearRadius}, 
                               ${-Math.cos(yearAngle) * yearRadius})`)
            .append("text")
            .attr('dx', 0)
            .attr('dy', 0)
            .text(formatYear(data[index].date).toLowerCase())
            .attr("font-weight", 550)
            .attr("font-size", 10)
            .style('text-transform', 'small-caps')
            .style('fill', 'black')
            .style('text-anchor', 'middle')
            .attr('class', 'labels')
      }       

      if (data[index].date.getDate() === 1){
         const currentDate = data[index].date;
         const currentYear = currentDate.getFullYear();
         const currentMonth = currentDate.getMonth();
         // Check if date is between Oct 2021 and Sep 2022
         if ((currentYear === 2021 && currentMonth >= 9) || (currentYear === 2022 && currentMonth <= 8)) {
            let textRadius = fromRadius + 30 // A magic number - feel free to improve!
            svg.append('text')
               .attr("transform", `translate(${Math.sin(fromAngle) * textRadius}, 
                  ${-Math.cos(fromAngle) * textRadius})`)
               .text(formatMonth(data[index].date).toLowerCase())
               .attr("font-weight", 550)
               .attr("font-size", 14)
               .style('font-variant', 'small-caps')
               .style('fill', 'black')
               .style('text-anchor', 'middle')
               .attr('class', 'labels')
         }
      }  

       const path = spiralArc (fromRadius, toRadius, height, fromAngle, toAngle);
       const color = colorScale(data[index].newConfirmed)
       svg.append('path')
           .attr('d', path)
           .style('fill', color)
   }
}
// Load the data
function init() {
   d3.csv("data/COVID_US_cases.csv", d => ({
       // JavaScript's Date object stores time in UTC internally.
       // We add a time zone offset to avoid potential issues.
       date: new Date(d.date + 'T12:00:00.000+08:00'),  
       // Convert confirmed cases to numbers; assume 0 if missing (NA)
       newConfirmed: +d.new_confirmed > 0 ? +d.new_confirmed : 0  
   })).then(data => {
       console.log(data); // Check if data loads correctly
       createVis(data)
   });
}

// Run `init()` when the page loads
window.addEventListener('load', init);