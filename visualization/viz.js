// From https://observablehq.com/@sw1227/bilinear-interpolation-of-tile
bilinearInterpolator = (func) => (x, y) => {
  // "func" is a function that takes 2 integer arguments and returns some value
  const x1 = Math.floor(x);
  const x2 = Math.ceil(x);
  const y1 = Math.floor(y);
  const y2 = Math.ceil(y);

  if (x1 === x2 && y1 === y2) return func(x1, y1);
  if (x1 === x2) {
    return (func(x1, y1) * (y2 - y) + func(x1, y2) * (y - y1)) / (y2 - y1);
  }
  if (y1 === y2) {
    return (func(x1, y1) * (x2 - x) + func(x2, y1) * (x - x1)) / (x2 - x1);
  }

  // else: x1 != x2 and y1 != y2
  return (
    (func(x1, y1) * (x2 - x) * (y2 - y) +
      func(x2, y1) * (x - x1) * (y2 - y) +
      func(x1, y2) * (x2 - x) * (y - y1) +
      func(x2, y2) * (x - x1) * (y - y1)) /
    ((x2 - x1) * (y2 - y1))
  );
};

function main() {
  function parseData(data) {
    return _.map(data, function (d) {
      return {
        date: new Date(_.toNumber(d["message_timestamp"]) * 1000),
        temps: _.map(JSON.parse(d["infared_temps"]), (d) => (9 / 5) * d + 32),
      };
    }).sort((d1, d2) => d1.date - d2.date);
  }

  function resampleData(data, width, height) {
    const interpolate = bilinearInterpolator();
    function getDataPoint(x, y) {
      return data[(x % 32) + y * 24];
    }
  }

  d3.csv("data.csv").then(function (data) {
    data = parseData(data);
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
    var minTemp = 32;
    var maxTemp = 140;
    var timelineArrowSize = 60;
    var timelinePadding = 40;
    var timelineMinX = timelinePadding;
    var timelineMaxX = svgWidth - timelinePadding;
    var timelineWidth = timelineMaxX - timelineMinX;
    var timelinePosition = [0, 490];
    var updateDebounce = 10;
    var currentDateVOffset = 10;
    svg.attr("width", svgWidth);
    svg.attr("height", svgHeight);
    var frameScale = d3
      .scaleTime()
      .domain(_.map(data, (d) => d.date))
      .range(_.map(data, (d) => d.temps));
    var timeLocScale = d3
      .scaleTime()
      .domain([
        _.minBy(data, (d) => d.date).date,
        _.maxBy(data, (d) => d.date).date,
      ])
      .range([timelineMinX, timelineMaxX])
      .nice();
    var frameLocScale = d3
      .scaleOrdinal()
      .domain(_.map(data, (d) => d.date))
      .range(_.map(data, (d) => timeLocScale(d.date)));
    var timelineAxis = d3
      .axisBottom(timeLocScale)
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
    var timelineFrameTicksNode = timelineNode
      .append("g")
      .attr("id", "timelineFrameTicks")
      .attr(
        "transform",
        `translate(${timelinePosition[0]},${timelinePosition[1]})`
      )
      .call(
        d3
          .axisBottom(frameLocScale)
          .tickSize(3)
          .tickFormat(() => "")
      );
    timelineNode
      .selectAll("#timelineFrameTicks line")
      .attr("stroke", "yellow")
      .attr("fill", "yellow")
      .attr("transform", "translate(0, 1)");
    timelineFrameTicksNode.select(".domain").attr("visibility", "hidden");

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
          var topPosition =
            10 +
            timelinePosition[1] +
            timelineTicksNode.node().getBBox().height +
            currentDateVOffset;
          return `translate(${leftSidePosition}, ${topPosition})`;
        });
    }

    var frameNode = svg.append("g").attr("id", "infaredHeatmap");

    var scaleX = d3.scaleOrdinal(_.range(32), _.range(0, graphWidth, width));
    var scaleY = d3.scaleOrdinal(
      _.range(24),
      _.rangeRight(0, graphHeight, height)
    );
    var colorScale = d3.scaleSequential(d3.interpolateInferno);

    function scaleFTemp(temp) {
      temp += 5;
      var numerator =
        Math.pow(temp + 74, 5) + Math.pow(temp, 5) - Math.pow(temp, 3);
      var denominator = Math.pow(maxTemp + 47, 5);
      var scaledTemp = numerator / denominator;
      var scaledTemp = scaledTemp < 0 ? 0.05 : scaledTemp;
      var scaledTemp = scaledTemp > 1 ? 1 : scaledTemp;
      return scaledTemp;
    }

      var tooltip = null;
      
    function makeFrame(temps) {
      var frame = frameNode.selectAll("g.heatRect").data(temps);
      frame.exit().remove();
      frame = frame
        .enter()
        .append("g")
        .attr("class", "heatRect")
        .attr("id", (d, i) => `rect${i}`)
        .merge(frame);
      frame
        .append("rect")
        .attr("id", (d, i) => `rectShape${i}`)
        .attr("fill", (d) => colorScale(scaleFTemp(d)))
        .attr("x", (d, i) => scaleX(i % 32))
        .attr("y", (d, i) => scaleY(Math.floor(i / 32)))
        .attr("width", width)
        .attr("height", height);
      if (tooltip == undefined) {
        tooltip = frameNode
          .append("text")
          .attr("class", "valueMouseover")
          .attr("fill", "white")
          .style("font-family", "Arial")
          .style("-webkit-font-smoothing", "antialiased")
          .style("-moz-osx-font-smoothing", "grayscale");
        frameNode.on('mouseout', function() { tooltip.attr('visibility', 'hidden')})
      }
      frameNode.selectAll(".heatRect rect").on(
        "mouseover",
        _.debounce(function (d, v) {
          var rect = d3.select(this);
          tooltip
            .attr('visibility', 'visible')
            .attr("x", _.toNumber(rect.attr("x")) + 30)
            .attr("y", _.toNumber(rect.attr("y")) + 20)
            .text(d3.format(".1f")(v) + '\u00B0F');
        }, 10)
      );
    }

    var timelineArrowSymbol = d3
      .symbol()
      .size(timelineArrowSize)
      .type(d3.symbolTriangle);
    var timelineArrowNode = timelineNode
      .append("g")
      .attr("id", "timelineArrow");
    var timelineSymbolNode = timelineArrowNode
      .append("path")
      .attr("id", "timelineArrowSymbol")
      .attr("d", timelineArrowSymbol)
      .attr("fill", "black");

    function timelineArrowTransform(location) {
      var transform = `translate(${location},${
        timelinePosition[1] - timelineArrowSize * 0.1
      }) scale(1,-1)`;
      return transform;
    }

    function setTimelineArrow(location) {
      if (location > timelineMaxX) {
        location = timelineMaxX;
      } else if (location < timelineMinX) {
        location = timelineMinX;
      }
      timelineSymbolNode.attr("transform", timelineArrowTransform(location));
    }

    function initializeTimelineArrow(tickLocation) {
      var symbolWidth = timelineArrowNode.node().getBBox().width;
      var symbolHeight = timelineArrowNode.node().getBBox().height;
      var tickWidth = d3.select("#timelineTicks .tick").node().getBBox().width;
      var tickCenterPosition = tickLocation + tickWidth / 2;
      if (tickWidth <= symbolWidth) {
        var symbolLeftPosition = tickCenterPosition - symbolWidth / 2;
      } else {
        var symbolLeftPosition = tickCenterPosition + symbolWidth / 2;
      }
      setTimelineArrow(symbolLeftPosition);
    }

    function getClosestMatchingDate(date) {
      return _.findLast(data, (d) => d.date <= date).date || _.last(data).date;
    }

    function updateFrame(date) {
      var closestDate = getClosestMatchingDate(date);
      setTimelineArrow(timeLocScale(closestDate));
      makeFrame(frameScale(closestDate));
      updateCurrentDateNode(closestDate);
    }

    var debouncedUpdateFrame = _.debounce(updateFrame, updateDebounce);

    function initializeTimelineArrowDragging() {
      var arrow = d3.select("#timelineArrow").call(
        d3
          .drag()
          .on("start", (event) => null)
          .on("drag", (event) =>
            debouncedUpdateFrame(timeLocScale.invert(event.x))
          )
          .on("end", (event) => null)
      );
    }

    makeFrame(frameScale(initialDate));
    initializeTimelineArrow(timeLocScale(initialDate));
    initializeTimelineArrowDragging();
    updateCurrentDateNode(initialDate);
  });
}
