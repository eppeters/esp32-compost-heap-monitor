// From https://observablehq.com/@sw1227/bilinear-interpolation-of-tile
bilinearInterpolator = (func, xMax, yMax) => (x, y) => {
  // "func" is a function that takes 2 integer arguments and returns some value
  const x1 = Math.floor(x);
  var x2 = Math.ceil(x);
  x2 = x2 > xMax ? x1 : x2;
  const y1 = Math.floor(y);
  var y2 = Math.ceil(y);
  y2 = y2 > yMax ? y1 : y2;

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

function resampleTemps(data, originWidth, originHeight, newWidth, newHeight) {
  function getDataPoint(x, y) {
    var dataItem = data[y * originWidth + x];
    return dataItem;
  }
  const interpolate = bilinearInterpolator(
    getDataPoint,
    originWidth - 1,
    originHeight - 1
  );
  var nW = newWidth / originWidth;
  var nH = newHeight / originHeight;
  return d3.range(0, originHeight, 1 / nH).map((y) =>
    d3.range(0, originWidth, 1 / nW).map((x) => {
      return interpolate(x, y);
    })
  );
}

function makeInfaredGraph(data) {
  var minDate = _.maxBy(data, (d) => d.date).date;
  var maxDate = _.maxBy(data, (d) => d.date).date;
  var initialDate = maxDate;
  var container = d3.select('#infared')
  var canvas = container.append('canvas').attr('id', 'infaredHeatmap');
  var context = canvas.node().getContext('2d');
  var width = 8;
  var height = 8;
  var axisHeight = 120;
  var numCols = 32;
  var numRows = 24;
  var canvasWidth = 640;
  var canvasHeight = 480 + axisHeight;
  var graphWidth = canvasWidth;
  var graphHeight = canvasHeight - axisHeight;
  var minTemp = 32;
  var maxTemp = 140;
  var timelineArrowSize = 60;
  var timelinePadding = 40;
  var timelineMinX = timelinePadding;
  var timelineMaxX = canvasWidth - timelinePadding;
  var timelineWidth = timelineMaxX - timelineMinX;
  var timelinePosition = [0, 490];
  var updateDebounce = 10;
  var currentDateVOffset = 10;
  canvas.attr("width", canvasWidth);
  canvas.attr("height", canvasHeight);
  var frameScale = d3
    .scaleTime()
    .domain(_.map(data, (d) => d.date))
    .range(_.map(data, (d) => d.infared_temps));
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
  var timelineNode = container.append('svg').append("g").attr("id", "timeline");
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

  container.selectAll("#timelineTicks text").attr("transform", function (d) {
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

  // This is a custom node type for our virtual DOM
  var frameNode = d3.select(document.createElement('canvasDataContainer'));

  var scaleX = d3.scaleOrdinal(
    _.range(graphWidth / width),
    _.range(0, graphWidth, width)
  );
  var scaleY = d3.scaleOrdinal(
    _.range(graphHeight / height),
    _.rangeRight(0, graphHeight, height)
  );
  var colorScale = d3.scaleSequential(d3.interpolateInferno);

  function scaleFTemp(temp) {
    temp += 5;
    var numerator =
      Math.pow(temp + 80, 5) + Math.pow(temp, 5) - Math.pow(temp, 3);
    var denominator = Math.pow(maxTemp + 47, 5);
    var scaledTemp = numerator / denominator;
    var scaledTemp = scaledTemp < 0 ? 0.05 : scaledTemp;
    var scaledTemp = scaledTemp > 1 ? 1 : scaledTemp;
    return scaledTemp;
  }

  var tooltip = null;

  function makeFrame(temps) {
    context.clearRect(0, 0, graphWidth, graphHeight);
    temps = resampleTemps(
      temps,
      numCols,
      numRows,
      graphWidth / width,
      graphHeight / height
    );
    temps = _.flatten(temps);
    var frameUpdate = frameNode.selectAll("rect.pixel").data(temps);
    frameUpdate
      .enter()
      .append("canvasDataContainer") // custom node
      .attr(
        "id",
        (d, i) =>
          `x${i % (graphWidth / width)}y${Math.floor(i / (graphWidth / width))}`
      )
      .attr("x", (d, i) => scaleX(i % (graphWidth / width)))
      .attr("y", (d, i) => scaleY(Math.floor(i / (graphWidth / width))))
      .attr("width", width)
      .attr("height", height)
      .merge(frameUpdate)
      .attr("fillstyle", (d) => colorScale(scaleFTemp(d)));
    // Render frameNode elements as canvas
    frameNode.selectAll('canvasDataContainer').each(function(d, i) {
      var node = d3.select(this);
      context.fillStyle = node.attr('fillstyle');
      context.fillRect(node.attr('x'), node.attr('y'), node.attr('width'), node.attr('height'));
    });
/**
    if (tooltip == undefined) {
      tooltip = frameNode
        .append("text")
        .attr("class", "valueMouseover")
        .attr("fill", "white")
        .style("font-family", "Arial")
        .style("-webkit-font-smoothing", "antialiased")
        .style("-moz-osx-font-smoothing", "grayscale");
      frameNode.on("mouseout", function () {
        tooltip.attr("visibility", "hidden");
      });
    }
    frameNode.selectAll("rect.pixel").on(
      "mouseover",
      _.debounce(function (d, v) {
        var rect = d3.select(this);
        tooltip
          .attr("visibility", "visible")
          .attr("x", _.toNumber(rect.attr("x")) + 30)
          .attr("y", _.toNumber(rect.attr("y")) + 20)
          .text(d3.format(".1f")(v) + "\u00B0F");
      }, 10)
    );
    */
  }

  var timelineArrowSymbol = d3
    .symbol()
    .size(timelineArrowSize)
    .type(d3.symbolTriangle);
  var timelineArrowNode = timelineNode.append("g").attr("id", "timelineArrow");
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
  setTimelineArrow(timeLocScale(initialDate));
  initializeTimelineArrowDragging();
  updateCurrentDateNode(initialDate);
}

function makeProbeGraph(data) {
  var svg = d3.select("#probes");
  var axisHeight = 120;
  var numCols = 32;
  var numRows = 24;
  var svgWidth = 640;
  var svgHeight = 480 + axisHeight;
  var graphWidth = svgWidth;
  var graphHeight = svgHeight - axisHeight;
  svg.attr("width", svgWidth);
  svg.attr("height", svgHeight);
  var topTemps = _.map(data, (d) => d.probe_temp_top);
  var middleTemps = _.map(data, (d) => d.probe_temp_middle);
  var bottomTemps = _.map(data, (d) => d.probe_temp_bottom);
  var minDate = _.minBy(data, (d) => d.date).date;
  var maxDate = _.maxBy(data, (d) => d.date).date;
  var minTemp = 0;
  var maxTemp = 180;
  var timelinePadding = 40;
  var timelineMinX = timelinePadding;
  var timelineMaxX = svgWidth - timelinePadding;
  var timelineWidth = timelineMaxX - timelineMinX;
  var timelinePosition = [0, 490];
  var scaleX = d3
    .scaleTime()
    .domain([minDate, maxDate])
    .range([timelinePadding, graphWidth - timelinePadding])
    .nice();
  var scaleY = d3
    .scaleLinear()
    .domain([minTemp, maxTemp])
    .range([graphHeight, 0])
    .nice();
  var accessorX = (d, i, ds) => scaleX(data[i].date);
  var accessorY = (d, i, ds) => scaleY(ds[i]);
  var lineMaker = d3.line().x(accessorX).y(accessorY).curve(d3.curveMonotoneX);
  function tempLine(temps, color) {
    svg
      .append("g")
      .attr("id", "topLine")
      .append("path")
      .attr("d", lineMaker(temps))
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", 2);
  }
  var timelineAxis = d3
    .axisBottom(scaleX)
    .tickFormat(d3.timeFormat("%m/%d %H:%M"));
  var tempAxis = d3
    .axisLeft(scaleY)
    .tickFormat(d => d3.format(",d")(d) + "\u00B0F");
  var probeTempsAxisNode = svg.append('g').attr('id', 'probeTempsAxis')
  probeTempsAxisNode.append('g').attr('id', 'probeTempsAxisTicks').attr("transform", `translate(40, 10)`).call(tempAxis);
  var timelineNode = svg.append("g").attr("id", "probeTimeline");
  var timelineTicksNode = timelineNode
    .append("g")
    .attr("id", "probeTimelineTicks")
    .attr(
      "transform",
      `translate(${timelinePosition[0]},${timelinePosition[1]})`
    )
    .call(timelineAxis);
  svg.selectAll("#probeTimelineTicks text").attr("transform", function (d) {
    return (
      "translate(" +
      this.getBBox().height * -2 +
      "," +
      (this.getBBox().height + 10) +
      ")rotate(-45)"
    );
  });
  tempLine(topTemps, "blue");
  tempLine(middleTemps, "yellow");
  tempLine(bottomTemps, "red");
}

function main() {
  function parseData(data) {
    function cToF(t) {
      return (9/5) * t + 32
    }
    return _.map(data, function (d) {
      return {
        date: new Date(_.toNumber(d["message_timestamp"]) * 1000),
        infared_temps: _.map(
          JSON.parse(d["infared_temps"]),
          cToF
        ),
        probe_temp_top: cToF(_.toNumber(d["probe_temp_top"])),
        probe_temp_middle: cToF(_.toNumber(d["probe_temp_middle"])),
        probe_temp_bottom: cToF(_.toNumber(d["probe_temp_bottom"])),
      };
    });
  }

  d3.csv("data.csv").then(function (data) {
    data = parseData(data);
    makeInfaredGraph(data);
    makeProbeGraph(data);
  });
}
