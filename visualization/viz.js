function main() {
  function parseData(data) {
    return _.map(data, function (d) {
      return {
        date: new Date(_.toNumber(d["message_timestamp"]) * 1000),
        temps: JSON.parse(d["infared_temps"]),
      };
    });
  }
  d3.csv("data.csv").then(function (data) {
    data = parseData(data).sort((d1, d2) => d1 - d2);
    var minDate = _.maxBy(data, (d) => d.date).date;
    var maxDate = _.maxBy(data, (d) => d.date).date;
    var initialDate = maxDate;
    var svg = d3.select("#infared");
    var width = 20;
    var height = 20;
    var axisHeight = 120;
    var svgWidth = 32 * width;
    var svgHeight = 24 * height + axisHeight;
    var graphWidth = svgWidth;
    var graphHeight = svgHeight - axisHeight;
    var timelinePadding = 40;
    var timelineMinX = timelinePadding;
    var timelineMaxX = svgWidth - timelinePadding;
    var timelineWidth = timelineMaxX - timelineMinX;
    var timelinePosition = [0, 490];
    var currentDateVOffset = 10;
    svg.attr("width", svgWidth);
    svg.attr("height", svgHeight);
    var framesScale = d3
      .scaleTime()
      .domain(_.map(data, (d) => d.date))
      .range(_.map(data, (d) => d.temps));
    var timeScale = d3
      .scaleTime()
      .domain([
        _.minBy(data, (d) => d.date).date,
        _.maxBy(data, (d) => d.date).date,
      ])
      .range([timelineMinX, timelineMaxX])
      .nice();
    var timelineAxis = d3
      .axisBottom(timeScale)
      .tickFormat(d3.timeFormat("%m/%d %H:%M"));
    var timelineNode = svg.append("g").attr("id", "timeline");
    var timelineTicksNode = timelineNode
      .append("g")
      .attr("id", "timelineTicks")
      .attr(
        "transform",
        `translate(${timelinePosition[0]},${timelinePosition[1]})`
      )
      .call(timelineAxis);
    svg.selectAll("#timelineTicks text").attr("transform", function (d) {
      return (
        "translate(" +
        this.getBBox().height * -2 +
        "," +
        (this.getBBox().height + 10) +
        ")rotate(-45)"
      );
    });
    var currentDateNode = timelineNode
      .append("g")
      .attr("id", "currentDate")
      .append("text");

    function updateCurrentDateNode(currentDate) {
      currentDateNode
        .text(currentDate)
        .attr("transform", function centerCurrentDateText(d) {
          var curWidth = this.getBBox().width;
          var leftSidePosition =
            timelinePadding + timelineWidth / 2 - curWidth / 2;
          var topPosition = 10 + timelinePosition[1] + timelineTicksNode.node().getBBox().height + currentDateVOffset;
          return `translate(${leftSidePosition}, ${topPosition})`;
        });
    }

    makeFrame(framesScale(initialDate));
    setTimelineArrow(timeScale(initialDate));
    updateCurrentDateNode(initialDate);

    function makeFrame(temps) {
      var scaleX = d3.scaleOrdinal(_.range(32), _.range(0, graphWidth, width));
      var scaleY = d3.scaleOrdinal(
        _.range(24),
        _.rangeRight(0, graphHeight, height)
      );
      var colorScale = d3.scaleSequential(d3.interpolatePlasma);

      function scaleFTemp(temp) {
        return temp / 140;
      }

      svg
        .append("g")
        .attr("id", "infaredHeatmap")
        .selectAll("rect")
        .data(temps)
        .enter()
        .append("g")
        .attr("id", (d, i) => `rect${i}`)
        .append("rect")
        .attr("fill", (d) => colorScale(scaleFTemp(d)))
        .attr("x", (d, i) => scaleX(i % 32))
        .attr("y", (d, i) => scaleY(Math.floor(i / 32)))
        .attr("width", width)
        .attr("height", height)
        .text((d) => d);
    }

    function setTimelineArrow(location) {
      var size = 60;
      var symbol = d3.symbol().size(size).type(d3.symbolTriangle);
      var symbolNode = timelineNode
        .append("g")
        .attr("id", "timelineArrow")
        .append("path")
        .attr("d", symbol)
        .attr("fill", "black");
      function transform(d) {
        var transform = `translate(${location},${
          timelinePosition[1] - size * 0.1
        }) scale(1,-1)`;
        return transform;
      }
      symbolNode.attr("transform", transform);
    }
  });
}
