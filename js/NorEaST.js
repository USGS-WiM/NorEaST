// Blake Draper 2013
dojo.require("esri.map");
dojo.require("esri.dijit.Popup")
dojo.require("esri.dijit.Legend");
dojo.require("esri.dijit.BasemapGallery");
dojo.require("esri.arcgis.utils");
dojo.require("esri.virtualearth.VETiledLayer");
dojo.require("esri.tasks.locator");

dojo.require("dojox.grid.DataGrid");
dojo.require("dojo.data.ItemFileReadStore");

dojo.require("dijit.TitlePane");
dojo.require("dijit.Tooltip");
dojo.require("dijit.Toolbar");
dojo.require("dijit.Menu");
dojo.require("dijit.TooltipDialog");

dojo.require("dijit.layout.BorderContainer");
dojo.require("dijit.layout.ContentPane");

dojo.require("dijit.form.CheckBox");
dojo.require("dijit.form.DateTextBox");
dojo.require("dijit.form.ComboBox");
dojo.require("dijit.form.Button");
dojo.require("dijit.form.DropDownButton");
dojo.require("dijit.form.FilteringSelect");
dojo.require("dijit.Dialog");

dojo.require("wim.ExtentNav");
dojo.require("wim.LatLngScale");
dojo.require("wim.CollapsingContainer");
dojo.require("wim.RefreshScreen");
dojo.require("wim.LoadingScreen");

      
var map, legendLayers = [];
var identifyTask, identifyParams;

var navToolbar;
var locator;
var locator2;

var stateStore;
var agencyStore;

var sitesLayer;
var layerDefinitions = [];
var noRecordsQuery;

var filterCount;

var inCreateMode = false;

var createDialog;
     
function init() {
	
	var popup = new esri.dijit.Popup({},dojo.create("div"));
	
	map = new esri.Map("map", {
    	basemap: "topo",
		wrapAround180: true,
		extent: new esri.geometry.Extent( {"xmin":-14086427.068614814,"ymin":2550521.1679928047,"xmax":-4693845.032934853,"ymax":7770252.955529533,"spatialReference":{"wkid":102100}}),
		slider: true,
		sliderStyle: "small",
		logo:false,
		infoWindow: popup
	});
	
    navToolbar = new esri.toolbars.Navigation(map);
	
    dojo.connect(map, "onLoad", mapReady);
	
	var basemapGallery = new esri.dijit.BasemapGallery({
		showArcGISBasemaps: true,
		map: map
	}, "basemapGallery");
	basemapGallery.startup();
	
	dojo.connect(basemapGallery, "onError", function(msg) {console.log(msg)});
	
	//dojo.connect(map, "onClick", executeSiteIdentifyTask);

	//currently removed from the map
    //var studyAreaLayer = new esri.layers.ArcGISDynamicMapServiceLayer("http://commons.wim.usgs.gov/arcgis/rest/services/Noreast/studyArea/MapServer", {"visible":true, "opacity": 0.5 });
	//legendLayers.push({layer:studyAreaLayer,title:'Study Area'});

    sitesLayer = new esri.layers.ArcGISDynamicMapServiceLayer("http://commons.wim.usgs.gov/arcgis/rest/services/Noreast/StreamTempSites/MapServer", {"visible":true });
	legendLayers.push({layer:sitesLayer,title:'Stream Temp Data Sites'});
	
	var stateTable = new esri.layers.FeatureLayer("http://commons.wim.usgs.gov/arcgis/rest/services/Noreast/StreamTempSites/MapServer/3", { mode: esri.layers.FeatureLayer.MODE_SELECTION, outFields: ["*"]});
	
	var orgTable = new esri.layers.FeatureLayer("http://commons.wim.usgs.gov/arcgis/rest/services/Noreast/StreamTempSites/MapServer/4", { mode: esri.layers.FeatureLayer.MODE_SELECTION, outFields: ["*"]});
	
	sitesLayer.setDisableClientCaching(true);
	
	var stateQuery = new esri.tasks.Query();
	stateQuery.where = "STATE_NAME IS NOT null";
	//stateQuery.returnDistinctValues = true;
	//stateQuery.returnGeometry = false;
	//stateQuery.outFields = ["STATE"];
	
	var agencyQuery = new esri.tasks.Query();
	agencyQuery.where = "ORG_NAME IS NOT null";
	
	//be certain to set the searchAttr property to the desired search and display value over on the HTML index page on the FilterSelect node. in the case below, "stateName". 
	stateTable.queryFeatures(stateQuery, function(featureSet) {
          var stateFilterValues = dojo.map(featureSet.features, function(feature) {
            return {
              stateName: feature.attributes.STATE_NAME
            };
          });

		  stateFilterValues.unshift( new Object ({stateName: " All"}));

		  var stateDataItems = {
		  	identifier: 'stateName',
			label: 'stateName',
			items: stateFilterValues
		  };
		   
		  stateStore = new dojo.data.ItemFileReadStore({
		  	data: stateDataItems
		  });
		  
		  dijit.byId("stateSelectInput").set("store", stateStore);

	});
	
	orgTable.queryFeatures(agencyQuery, function(featureSet) {
          var agencyFilterValues = dojo.map(featureSet.features, function(feature) {
            return {
			  agency: feature.attributes.ORG_NAME
            };
          });
		  
		  agencyFilterValues.unshift( new Object ({ agency: " All"}));
		   
		  var agencyDataItems = {
		  	identifier: 'agency',
			label: 'agency',
			items: agencyFilterValues
		  };
			  
		  agencyStore = new dojo.data.ItemFileReadStore({
		  	data: agencyDataItems
		  });
			
		  dijit.byId("agencySelectInput").set("store", agencyStore);
	});

	dojo.connect(map,'onLayersAddResult',function(results){
		var legend = new esri.dijit.Legend({
			map:map,
			layerInfos:legendLayers
		},"legendDiv");
		legend.startup();
	});
	
	identifyParams = new esri.tasks.IdentifyParameters();
    identifyParams.tolerance = 15;
    identifyParams.returnGeometry = true;
    identifyParams.layerOption = esri.tasks.IdentifyParameters.LAYER_OPTION_ALL;
    identifyParams.width  = map.width;
    identifyParams.height = map.height;
    identifyTask = new esri.tasks.IdentifyTask("http://commons.wim.usgs.gov/arcgis/rest/services/Noreast/StreamTempSites/MapServer");

    /*function executeSiteIdentifyTask(evt) {
        identifyParams.geometry = evt.mapPoint;
        identifyParams.mapExtent = map.extent;
       
        var deferred = identifyTask.execute(identifyParams);

        deferred.addCallback(function(response) {     
            // response is an array of identify result objects    
            // Let's return an array of features.
            return dojo.map(response, function(result) {
                var feature = result.feature;
                feature.attributes.layerName = result.layerName;
                
                var template = new esri.InfoTemplate(
					"${SITE_NAME}",
                    "<b>Agency</b>: ${AGENCY}<br/>" +
					"<b>Site Name</b>: ${SITE_NAME}<br/>" +
					"<b>Waterbody Name</b>: ${WB_NAME}<br/>" +
					"<b>Location Description</b>: ${LOC_DESC}<br/>" +
					"<b>State</b>: ${STATE}<br/>" +
                    "<b>Organization Category</b>: ${ORG_CATEGORY}<br/>" +
                    "<b><a target=\"blank\" href=\"http://waterdata.usgs.gov/nwis/uv?site_no=" + "${LEGACY_ID}\">Click for more info (USGS Sites Only)</a></b>");
                feature.setInfoTemplate(template);
                
                return feature;
            });
        });

        map.infoWindow.setFeatures([ deferred ]);
        map.infoWindow.show(evt.mapPoint);
      }*/

	map.addLayers( [sitesLayer]);
	
	dojo.connect(map, 'onLayersAddResult', function(results){
		
		dojo.forEach (legendLayers, function(layer){
			var layerName = layer.title;
			var checkBox = new dijit.form.CheckBox({
				name:"checkBox" + layer.layer.id,
				value:layer.layer.id,
				checked:layer.layer.visible,
				onChange:function(evt){
					var checkLayer = map.getLayer(this.value);
					checkLayer.setVisibility(!checkLayer.visible);
					this.checked = checkLayer.visible;						
				}
			});
			
			dojo.place(checkBox.domNode,dojo.byId("toggle"),"after");
			var checkLabel = dojo.create('label',{'for':checkBox.name,innerHTML:layerName},checkBox.domNode,"after");
			dojo.place("<br/>",checkLabel,"after");
			
			
		});
	});
}

function updateSitesLayer(filterParams){
	
	console.log("updateSitesLayer function fired");
	
	var stateDef;
	var agencyDef;
	var fromDateValue;
	var toDateValue;
	layerDefinitions = [];
	
	//dijit.byId('toDate').constraints.min = arguments[0];
	//dijit.byId('fromDate').constraints.max = arguments[0];

	//for unknown stupid reason, date fields must come first in the layerDef expression. 
	if (!(dijit.byId("fromDate").displayedValue == "")) {
		layerDefinitions.push("\"DATA_START\" >= date '" + dijit.byId("fromDate").displayedValue + "'");
	}
	
	if (!(dijit.byId("toDate").displayedValue == "")) {
		layerDefinitions.push("\"DATA_END\" <= date '" + dijit.byId("toDate").displayedValue + "'");
	}
	if (!(dijit.byId("stateSelectInput").value == " All" || dijit.byId("stateSelectInput").value == "")) {
		layerDefinitions.push("\"STATE\" LIKE '" +  dijit.byId("stateSelectInput").value + "'");
	}
	
	if (!(dijit.byId("agencySelectInput").value == " All" || dijit.byId("agencySelectInput").value == "")) {
		layerDefinitions.push("\"AGENCY\" LIKE '" +  dijit.byId("agencySelectInput").value + "'");
	}
	
	if (layerDefinitions.length == 0)
	{
		layerDefinitions = ['']; 
	}
	else
	{
		layerDefinitions = ['((' + layerDefinitions.join(") AND (") + '))'];
	}
	
	console.log(layerDefinitions[0]);
	console.log("layer def updated");
	
}

//begin displayCreateDialog function
function displayFilterCount () {
	console.log("displayFilterCount function fired");
	
	dojo.attr("filterCountText", {innerHTML:"Your filter selection returned " + filterCount + " results."});
	
	dojo.byId("filterCountIndicator").style.visibility = "visible";

}
//end displayCreateDialog function


function executeUpdateSites (evt) {
	sitesLayer.setDisableClientCaching(true);
	sitesLayer.setLayerDefinitions(layerDefinitions);
	sitesLayer.refresh();
	
	noRecordsQueryTask = new esri.tasks.QueryTask("http://commons.wim.usgs.gov/arcgis/rest/services/Noreast/StreamTempSites/MapServer/0");
	noRecordsQuery = new esri.tasks.Query();

	noRecordsQuery.returnGeometry =true;
	noRecordsQuery.where = layerDefinitions[0];

	noRecordsQueryTask.execute(noRecordsQuery,onQueryComplete);

	function onQueryComplete (results){

		var selectionExtent = new esri.graphicsExtent(results.features);

		if (results.features.length > 1){
			map.setExtent(selectionExtent, true);
		} else {
			//Zoom to the location of the single returned feature's geometry
			var singleSiteGraphic = results.features[0];
			var location = new esri.geometry.Point(singleSiteGraphic.geometry.x, singleSiteGraphic.geometry.y, map.spatialReference);
			map.centerAndZoom(location, 15)
		}
	}


	if (layerDefinitions[0] != "") {
	noRecordsQueryTask.executeForCount(noRecordsQuery, function (count){ 
		filterCount = count;
		console.log(count);
		
		displayFilterCount();
			
	});
	
	}
	
	console.log("layer def update executed and refreshed");
	
}

function clearSelections (){

	layerDefinitions.length = 0;

	var blankString = '';

	dijit.byId("stateSelectInput").setDisplayedValue(blankString);
	dijit.byId("agencySelectInput").setDisplayedValue(blankString);
	dijit.byId("fromDate").setDisplayedValue(blankString);
	dijit.byId("toDate").setDisplayedValue(blankString);

	dojo.byId("filterCountIndicator").style.visibility = "hidden";

	for (var i = 0; i < legendLayers.length; i++) {
		if (legendLayers[i].layer !== null){
			legendLayers[i].layer.setLayerDefinitions(layerDefinitions);
		}
	}

	var fullExtent = new esri.geometry.Extent({"xmin":-14086427.068614814,"ymin":2550521.1679928047,"xmax":-4693845.032934853,"ymax":7770252.955529533,"spatialReference":{"wkid":102100}});
	map.setExtent(fullExtent);

}


//begin toggleCreateMode
function toggleCreateMode (evt) {
	
	inCreateMode = !inCreateMode;

	if (inCreateMode){
		console.log("Create Mode On");
		dojo.byId("createModeIndicator").style.visibility = "visible";
	} else{
		console.log("Create Mode Off");
		dojo.byId("createModeIndicator").style.visibility = "hidden";
	}
	
}
//end toggleCreateMode


//begin displayCreateDialog function
function displayCreateDialog () {
	console.log("displayCreateDialog function fired");
	
	dojo.attr("createDialogCoordinates", {innerHTML:"You have clicked at Latitude " + latitude.toFixed(8) + " and Longitude " + longitude.toFixed(8) +
	" </br> The COM ID is {COMID} and the NHD PLUS ID is {NHD} </br>Would you like to create a new site at this location?"});
	
	dijit.byId("createDialog").show();

}

//end displayCreateDialog function

function createSite () {

	
	
}


function mapReady(map){ 

	var latLngBar = new wim.LatLngScale({map: map}, 'latLngScaleBar');
	
	//begin onClick function
	dojo.connect(map, "onClick", function(evt) {
	
		if (inCreateMode == true){
			
			 latitude = evt.mapPoint.getLatitude();
			 longitude = evt.mapPoint.getLongitude();
			
			console.log(latitude,longitude);
			
			displayCreateDialog();
			
		} else {
			
			identifyParams.geometry = evt.mapPoint;
			identifyParams.mapExtent = map.extent;
		   
			var deferred = identifyTask.execute(identifyParams);
	
			deferred.addCallback(function(response) {     
				// response is an array of identify result objects    
				// Let's return an array of features.
				return dojo.map(response, function(result) {
					var feature = result.feature;
					feature.attributes.layerName = result.layerName;


					if (result.feature.attributes.AGENCY === "US Geological Survey") {

						var usgsTemplate = new esri.InfoTemplate(
							"${SITE_NAME}",
							"<b>Agency</b>: ${AGENCY}<br/>" +
							"<b>Site Name</b>: ${SITE_NAME}<br/>" +
							"<b>Waterbody Name</b>: ${WB_NAME}<br/>" +
							"<b>Location Description</b>: ${LOC_DESC}<br/>" +
							"<b>State</b>: ${STATE}<br/>" +
							"<b>Organization Category</b>: ${ORG_CATEGORY}<br/>" +
							"<b><a target=\"blank\" href=\"http://waterdata.usgs.gov/nwis/inventory/?site_no=" + "${LEGACY_ID}" + "&agency_cd=USGS\">NWIS Site Info</a></b></br>" +
							"<b><a target=\"blank\" href=\" http://cida.usgs.gov/noreast-sds/results/" + "${NOREAST_ID}\">NorEaST Site Details</a></b>");
						feature.setInfoTemplate(usgsTemplate);
						
						return feature;


					} else { 
					
					var otherTemplate = new esri.InfoTemplate(
						"${SITE_NAME}",
						"<b>Agency</b>: ${AGENCY}<br/>" +
						"<b>Site Name</b>: ${SITE_NAME}<br/>" +
						"<b>Waterbody Name</b>: ${WB_NAME}<br/>" +
						"<b>Location Description</b>: ${LOC_DESC}<br/>" +
						"<b>State</b>: ${STATE}<br/>" +
						"<b>Organization Category</b>: ${ORG_CATEGORY}<br/>" +
						"<b><a target=\"blank\" href=\" http://cida.usgs.gov/noreast-sds/results/" + "${NOREAST_ID}\">NorEaST Site Details</a></b>");
					feature.setInfoTemplate(otherTemplate);
					
					return feature;
					}
				});
			});
	
			map.infoWindow.setFeatures([ deferred ]);
			map.infoWindow.show(evt.mapPoint);
		
		} //end of else statement
			
	});
	//end onClick function
	 
   //Geocoder Reference in init function
    locator = new esri.tasks.Locator("http://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer");
    locator2 = new esri.tasks.Locator("http://sampleserver1.arcgisonline.com/ArcGIS/rest/services/Locators/ESRI_Geocode_USA/GeocodeServer");
    dojo.connect(locator, "onAddressToLocationsComplete", showResults);
	
	dojo.style('loadingScreen', 'opacity', '0.75');
	var loadingUpdate = dojo.connect(map,"onUpdateStart",function(){
	dojo.style('loadingScreen', 'visibility', 'visible');
	});
	
	dojo.connect(map,"onUpdateEnd",function(){
		dojo.style('loadingScreen', 'visibility', 'hidden');
		dojo.disconnect(loadingUpdate);
	
		dojo.connect(map, "onUpdateStart",function(){
			dojo.style('refreshScreen', 'visibility', 'visible');
		});
		
		dojo.connect(map, "onUpdateEnd", function(){
			dojo.style('refreshScreen', 'visibility', 'hidden');
		});
	
	});
	
			    
}

dojo.ready(init);