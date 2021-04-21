function main() {
  var data = d3.json("data.json").then(function (data) {
    data = _.map(data, (o) => _.toNumber(_.partialRight(_.get, "N")(o)) * 9/5 + 32);
    console.log(data);
    var svg = d3.select("#infared");
    var width = 20;
    var height = 20;
    var svgWidth = 32 * width;
    svg.attr("width", 32 * width);
    var svgHeight = 24 * height;
    svg.attr("height", 24 * height);
    var scaleX = d3.scaleOrdinal(
      _.range(32),
      _.range(0, svgWidth, width)
    );
    var scaleY = d3.scaleOrdinal(
      _.range(24),
      _.rangeRight(0, svgHeight, height)
    );
    var colorScale = d3.scaleSequential(d3.interpolateTurbo);

    function scaleFTemp(temp) {
        return temp / 140
    }

    svg
      .append("g").attr('id', 'all')
      .selectAll("rect")
      .data(data)
      .enter()
      .append("g").attr('id', (d,i) => `rect${i}`)
      .append("rect")
      .attr('fill', d => colorScale(scaleFTemp(d)))
      .attr("x", (d, i) => scaleX(i % 32))
      .attr("y", (d, i) => scaleY(Math.floor(i / 32)))
      .attr("width", width)
      .attr("height", height)
      .text((d) => d);
  });
}
