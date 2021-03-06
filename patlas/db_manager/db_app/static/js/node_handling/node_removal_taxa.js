// function that adds links, avoiding duplication below on reAddNode function
const addLinks = (g, newListHashes, sequence, linkAccession, linkDistance) => {
  const currentHash = makeHash(sequence, linkAccession)
  if (newListHashes.indexOf(currentHash) < 0) {
    g.addLink(sequence, linkAccession, linkDistance)
    newListHashes.push(currentHash)
  }
  return newListHashes
}

// re adds nodes after cleaning the entire graph
const reAddNode = (g, jsonObj, newList, newListHashes) => {
  const sequence = jsonObj.plasmidAccession
  let length = jsonObj.plasmidLenght
  const linksArray = jsonObj.significantLinks
  // console.log(length)
  // console.log(newList.length)
  // checks if sequence is within the queried accessions (newList)
  if (newList.indexOf(sequence) < 0) {
    //console.log("sequence", sequence)
    g.addNode(sequence, {
      sequence: "<span style='color:#468499'>Accession:" +
      " </span><a" +
      " href='https://www.ncbi.nlm.nih.gov/nuccore/" + sequence.split("_").slice(0, 2).join("_") + "' target='_blank'>" + sequence + "</a>",
      seq_length: "<span style='color:#468499'>Sequence length: </span>" + ((length !== "N/A") ? length : "N/A"),
      log_length: (length !== "N/A") ? Math.log(parseInt(length)) : Math.log(2000)
    })
    newList.push(sequence)  //adds to list everytime a new node is added here
  }

  // loops between all arrays of array pairing sequence and distances
  if (linksArray !== "N/A") {
    const eachArray = linksArray.split("},")
    //console.log("testing", eachArray)
    for (let i = 0; i < eachArray.length; i++) {
      // this constructs a sorted array
      // TODO try to make this array ordered in the database using MASHix.py
      const entry = eachArray[i].replace(/[{}'u\[\] ]/g,"").split(",").slice(0).sort()
      const linkDistance = entry[1].split(":")[1]
      const linkLength = entry[2].split(":")[1]
      const linkAccession = entry[0].split(":")[1]

      // TODO make requests to get metadata to render the node
      // if node doesn't exist yet, add it and add the links
      if (newList.indexOf(linkAccession) < 0) {
        //console.log(linkAccession)
        g.addNode(linkAccession, {
          sequence: "<span style='color:#468499'>Accession:" +
          " </span><a" +
          " href='https://www.ncbi.nlm.nih.gov/nuccore/" + linkAccession.split("_").slice(0, 2).join("_") + "' target='_blank'>" + linkAccession + "</a>",
          seq_length: "<span" +
          " style='color:#468499'>Sequence length:" +
          " </span>" + linkLength,
          log_length: Math.log(parseInt(linkLength))
        })
        newList.push(linkAccession) //adds to list every time a node is
        // added here
        newListHashes = addLinks(g, newListHashes, sequence, linkAccession, linkDistance)
      } else {
        // if node exist, links still need to be added
        newListHashes = addLinks(g, newListHashes, sequence, linkAccession, linkDistance)
      }
    }
  }
  //storeMasterNode = storeRecenterDom(storeMasterNode, linksArray,
  //  sequence, counter)
  return [newList, newListHashes]
}

// function to call requests on db

const requesterDB = (g, listGiFilter, counter, renderGraph, graphics,
                     reloadAccessionList, renderer, list_gi, readString,
                     assemblyJson) => {
  // reloadAccessionList = []
  if (listGiFilter.length > 0) {
    let promises = []   //an array to store all the requests as promises
    let newListHashes = [] // similar to listHashes from first instance
    // loops every Accession stored in listGiFilter on re_run button
    for (let i = 0; i < listGiFilter.length; i++) {
      promises.push(
        $.get("api/getspecies/", {"accession": listGiFilter[i]},
          (data, status) => {
            // this request uses nested json object to access json entries
            // available in the database

            // if request return no speciesName or plasmidName
            // sometimes plasmids have no descriptor for one of these or both
            if (data.json_entry.name === null) {
              speciesName = "N/A"
            } else {
              speciesName = data.json_entry.name.split("_").join(" ")
            }
            if (data.json_entry.plasmid_name === null) {
              plasmidName = "N/A"
            } else {
              plasmidName = data.json_entry.plasmid_name
            }
            // if accession is not present in the database because singletons
            // are not stored in database
            if (data.json_entry.significantLinks === null) {
              // console.log("debug", listGiFilter[i])
              const jsonObj = {
                "plasmidAccession": listGiFilter[i],
                "plasmidLenght": "N/A",
                "speciesName": "N/A",
                "plasmidName": "N/A",
                "significantLinks": "N/A"
              }
              //add node
              reAddNodeList = reAddNode(g, jsonObj, reloadAccessionList, newListHashes)
              reloadAccessionList = reAddNodeList[0]
              newListHashes = reAddNodeList[1]

            } else {  // add node for every accession that has links and that is
              // present in plasmid_db
              const jsonObj = {
                "plasmidAccession": data.plasmid_id,
                "plasmidLenght": data.json_entry.length,
                "speciesName": speciesName,
                "plasmidName": plasmidName,
                // this splits the string into an array with each entry
                "significantLinks": data.json_entry.significantLinks//.split("],")
                // TODO this is sketchy and should be fixed with JSON parsing from db
              }
              //add node
              reAddNodeList = reAddNode(g, jsonObj, reloadAccessionList, newListHashes)
              reloadAccessionList = reAddNodeList[0]
              newListHashes = reAddNodeList[1]
            }
          })
      )
    }
    // promise that waits for all the requests and nodes to be added to
    // vivagraph.... and only then precompute the graph.
    Promise.all(promises)
      .then( () => {
        renderGraph(graphics)
        if (readString !== false) {
          readColoring(g, list_gi, graphics, renderer, readString)
        } else if (assemblyJson !== false) {
          masterReadArray = [] //needs to reset this array for the assembly
          // function to be successful
          listGiFilter = assembly(list_gi, assemblyJson, g, graphics, masterReadArray, listGiFilter)
          // TODO add support for mash_json (maybe it can use readString?
        } else if ($("#p_Card").html() !== "Card:" ||
          $("#p_Resfinder").html() !== "Resfinder:") {
          $("#resSubmit").click()
        } else if ($("#p_Plasmidfinder").html() !== "Plasmidfinder:") {
          $("#pfSubmit").click()
        } else if ($("#p_Species").html() !== "Species:" ||
          $("#p_Genus").html() !== "Genus:" ||
          $("#p_Family").html() !== "Family:" ||
          $("#p_Order").html() !== "Order:") {
          // simulates the click of the button
          // which checks the divs that contain the species, color the as if
          // the button was clicked and makes the legends
          $("#taxaModalSubmit").click()
        } else {
          colorNodes(g, graphics, listGiFilter, 0x23A900) //green color for
          // area selection
        }
      })
      .catch( (error) => {
        console.log("Error! No query was made. Error message: ", error)
      })
  }
  return [listGiFilter, reloadAccessionList]
}

// function that actually removes the nodes
const actual_removal = (g, graphics, onload) => {
  // removes all nodes from g using the same layout
  firstInstace = false
  // change play button in order to be properly set to pause
  $("#couve-flor").empty()
  // TODO check if this can be cleaner... removing vivagraph canvas?
  $("#couve-flor").append(
    "<!--hidden div for color legend-->\n" +
    "<div class='panel-group colorpicker-component' id='colorLegend' style='display: none'>\n" +
    "<div class='panel panel-default' >\n" +
    "<div class='panel-heading'>Color legend</div>\n" +
    "<div class='panel-body'>\n" +
    "<!--Populated by visualization_functions.js-->\n" +
    "<label id='taxa_label' style='display: none'>Taxa filters</label>\n" +
    "<ul class='legend' id='colorLegendBox'></ul>\n" +
    "<label id='res_label' style='display: none'>Resistances</label>" +
    "<ul class='legend' id='colorLegendBoxRes'></ul>" +
    "<label id='pf_label' style='display: none'>Plasmid Families</label>" +
    "<ul class='legend' id='colorLegendBoxPf'></ul>" +
    "<!--Populated by visualization_functions.js-->\n" +
    "<label id='distance_label' style='display: none'>Distance filters</label>\n" +
    "<div class='gradient' id='scaleLegend'></div>\n" +
    "<!--Populated by visualization_functions.js-->\n" +
    "<label id='read_label' style='display: none'>Read filters</label>\n" +
    "<div class='gradient' id='readLegend'></div>\n" +
    "<label id='assemblyLabel' style='display: none'>Assembly</label>" +
    "<div class='legend' id='assemblyLegend'></div>" +
    "</div>\n" +
    "</div>\n" +
    "</div>\n" +
    "\n" +
    "<div id='buttonStuff'>\n" +
    "<div class='btn-group'>\n" +
    "\n" +
    "<!-- Buttons that overlay the graph and interact with it -->\n" +
    "<button id='playpauseButton' data-toggle='tooltip' \n" +
    "        title='Play/Pause' type='button' \n" +
    "        class='btn btn-success'>\n" +
    "<span class='glyphicon glyphicon-play'></span>\n" +
    "</button>\n" +
    "\n" +
    "<button class='btn btn-primary' href='#' data-toggle='modal' " +
    "        data-backdrop='static' title='Quick stats' " +
    "        data-target='#modalPlot' id='refreshButton'>" +
    "<span class='glyphicon glyphicon-stats'></span>\n" +
    "</button>\n" +
    "</div>\n" +
    "<!--zoom buttons-->\n" +
    "<div class='btn-group'>\n" +
    "<button id='zoom_in' class='zoom in btn btn-default'\n" +
    "        data-toggle='tooltip' title='Zoom in' \n" +
    "        type='button'>\n" +
    "<span class='glyphicon glyphicon-zoom-in'></span>\n" +
    "</button>\n" +
    "<button id='zoom_out' class='zoom out btn btn-default'\n" +
    "        data-toggle='tooltip' title='Zoom out' \n" +
    "        type='button'>\n" +
    "<span class='glyphicon glyphicon-zoom-out'></span>\n" +
    "</button>\n" +
    "</div> \n" +
    "<div class='btn-group'>" +
    "<button id='slideLeft' class='zoom in btn btn-default' data-toggle='tooltip'" +
    "title='Change file' type='button' disabled>" +
    "<span class='glyphicon glyphicon-chevron-left'></span>" +
    "</button><button id='slideRight' class='zoom out btn btn-default'" +
    "data-toggle='tooltip' title='Change file'" +
    "type='button' disabled>" +
    "<span class='glyphicon glyphicon-chevron-right'></span></button>" +
    "</div>" +
    "<div id='fileNameDiv'></div>" +
    "</div>\n" +
    "<div id='popup_description' style='display: none'></div>"
)

  // should be executed when listGiFilter is empty ... mainly for area selection
  const reGetListGi = (g, graphics) => {
    let tempListAccessions = []
    g.forEachNode( (node) => {
      const currentNodeUI = graphics.getNodeUI(node.id)
      if (currentNodeUI.color === 0x23A900) { tempListAccessions.push(node.id) }
    })
    return tempListAccessions
  }
  listGiFilter = (listGiFilter.length === 0) ? reGetListGi(g, graphics) : listGiFilter

  onload()
  // TODO maybe add some nicer loading screen
}

// a function to display the loader mask
const show_div = (callback) => {
  $("#loading").show()
  // if callback exist execute it
  callback && callback()
}

// function to reset node colors
const node_color_reset = (graphics, g, nodeColor, renderer) => {
  document.getElementById('taxa_label').style.display = 'none' // hide label
  g.forEachNode( (node) => {
    const nodeUI = graphics.getNodeUI(node.id)
    // reset all nodes before changing colors because of the second instance of filters
    if (nodeUI.color !== nodeColor) {
      nodeUI.backupColor = nodeUI.color
      nodeUI.color = nodeColor
    }
  })
  renderer.rerender()
}

