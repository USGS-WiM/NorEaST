
/*
	Copyright: 2012 WiM - USGS
	Author: Blake Draper, USGS Wisconsin Internet Mapping
	Created: December 7, 2012
*/

dojo.provide("wim.ExtentNav");

dojo.require("dijit._Container");
dojo.require("dijit._TemplatedMixin");
dojo.require("dijit._WidgetBase");
dojo.require("dijit._OnDijitClickMixin");

dojo.require("esri.map");
dojo.require("esri.toolbars.navigation");

dojo.declare("wim.ExtentNav", [dijit._WidgetBase, dijit._OnDijitClickMixin, dijit._Container, dijit._TemplatedMixin], 
{
  templatePath: dojo.moduleUrl("wim", "templates/ExtentNav.html"),
  
  baseClass: "extentNav",  
  attachedMapID : null,
  initExtent: new esri.geometry.Extent({"xmin":-14086427.068614814,"ymin":2550521.1679928047,"xmax":-4693845.032934853,"ymax":7770252.955529533,"spatialReference":{"wkid":102100}}),
  
  constructor: function (){
	  
  },
  
  postCreate: function () {
	  
	  dojo.connect(navToolbar, "onExtentHistoryChange", extentHistoryChangeHandler);
	  
	  function extentHistoryChangeHandler() {
        dijit.byId("back").disabled = navToolbar.isFirstExtent(dojo.byId(map));
        dijit.byId("fwd").disabled = navToolbar.isLastExtent(dojo.byId(map));
      }	
	  
   },
   
		
  _onBackClick: function() {
		navToolbar.zoomToPrevExtent();
  },
  
  _onFwdClick: function () {
	  navToolbar.zoomToNextExtent();
  },
  
  _onFullClick: function () {
	 map.setExtent(this.initExtent);
	 
  }
  
});