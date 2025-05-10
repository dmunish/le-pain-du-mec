import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

const ForceGraph = () => {
  const svgRef = useRef();

  useEffect(() => {
    const nodes = [
      { id: "A" }, { id: "B" }, { id: "C" }
    ];
    const links = [
      { source: "A", target: "B" },
      { source: "B", target: "C" },
    ];

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // clear previous renders

    const width = 600;
    const height = 400;

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2));

    const link = svg.append("g")
      .attr("stroke", "#aaa")
      .selectAll("line")
      .data(links)
      .join("line");

    const node = svg.append("g")
      .attr("fill", "steelblue")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", 10)
      .call(
        d3.drag()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    node.append("title").text(d => d.id);

    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);
    });
  }, []);

  return <svg ref={svgRef} width={600} height={400}></svg>;
};

export default ForceGraph;
