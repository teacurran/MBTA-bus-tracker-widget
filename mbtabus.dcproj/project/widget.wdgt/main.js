var DEF_ROUTE_TAG       = '39';
var DEF_ROUTE_TITLE     = '39';
var DEF_DIR_TAG         = '39_390003v0_1';
var DEF_DIR_TITLE       = 'Back Bay Station via Copley Square';
var DEF_STOP_TAG        = '8750';
var DEF_STOP_TITLE      = 'Forest Hills Station - Departure (Stop 8750)';

var webserviceURLBase = 'http://webservices.nextbus.com/service/publicXMLFeed?a=mbta&';
var predictionURLBase = webserviceURLBase + "command=predictions&";

var version             = "1.6";
var versionURL          = "http://www.wirelust.com/apps/mbta/bustracker/version.txt";
var debug               = false;

var daysOfWeek      = new Array("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday");
var monthsOfYear    = new Array("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December");

var timerInterval = 15000;
var timer;
var lastRefresh = 0;
var prefRouteTag;
var prefRouteTitle;
var prefDirectionTag;
var prefDirectionTitle;
var prefStopTag;
var prefStopTitle;
var widgetId;

var refreshRouteInProgress = false;
var routesLoaded = false;

function changeDirection (elem) {
	var directionObj = getCurrentDirectionObject();
	if (directionObj) {
        var stopsList = directionObj.getStops();
        var stopsLength = stopsList.length;
        var stopHTML = '';
        var tag;
        var shortTitle;
        while(stopsLength--){
            if (stopsList[stopsLength].getStopId()) {
                tag = stopsList[stopsLength].getStopTag();
                shortTitle = stopsList[stopsLength].getStopTitle();
                stopHTML += createOptionTag(tag, shortTitle);
            }
        }
        
        $("#popupStop").html(stopHTML);
        $("#popupStop").val(prefStopTag);
        
        changeStop();
    }
}

function changeRoute () {
    savePrefs();
    
	var routeObj = getCurrentRouteObject();
    if (routeObj) {
        var directionsList = routeObj.getDirections();
        var directionsLength = directionsList.length;
        var directionHTML = '';
        var tag;
        var shortTitle;
        while(directionsLength--){
            tag = directionsList[directionsLength].getDirectionTag();
            title = directionsList[directionsLength].getDirectionTitle();
            directionHTML += createOptionTag(tag, title);
        }
        log("directionHTML:" + directionHTML);
        $("#popupDirection").html(directionHTML);
        $("#popupDirection").val(prefDirectionTag);
        $("#popupDirection").attr('disabled', false);
        $("#popupStop").attr('disabled', false);
        changeDirection();
    
    }
}

function changeStop() {
    savePrefs();
    refreshTimes();
}

function checkVersion() {
	var httpRequest = new XMLHttpRequest();
	
	httpRequest.onreadystatechange=function() {
		if (httpRequest.readyState == 4) {
            response = httpRequest.responseText;
            if (!response) {
                log("checkVersion responseXML is null!");
            } else {
                if (response.trim() > version) {
                    $("#labelUpdate").html("<a href=\"javascript:openUpdateInBrowser(null)\" style=\"color:red; text-decoration:none;\">Update Available: version " + response + "</a>&nbsp;<a href=\"javascript:openUpdateInBrowser(null)\" style=\"color:red; text-decoration:underline;\">download</a>");
                }
            }
        }
    }
	httpRequest.setRequestHeader("Cache-Control", "no-cache");
	httpRequest.open("GET", versionURL);
	httpRequest.send(null);    
}

function createOptionTag (val, label) {
    return('<option value="' + val + '">' + label + '</option>');
}

// Creates timestamp for valid results
function createTimeStamp() {
	var d = new Date();
	var timeOfDay	= 'AM'; 
	var hour			= d.getHours();
	if (hour >= 12) {
		timeOfDay = 'PM';
		if (hour > 12)hour -= 12;
	}
	var min			= d.getMinutes();
	min = (min < 10) ? '0'+min : min;
	var day			= this.daysOfWeek[d.getDay()];
	var month 		= this.monthsOfYear[d.getMonth()];;
	var date			= d.getDate();
	return ('Valid as of ' + hour + ':' + min + ' ' + timeOfDay + ' ' + day + ', ' + month + ' ' + date);
}

function getCurrentRouteObject (){
	var l = routeList.length;
	var currentRoute;
	while(l--) {
		currentRoute = routeList[l];
		if(currentRoute.getRouteTag() == $("#popupRoute").val()) {
            if (currentRoute.isLoaded()) {
                return currentRoute;
            } else if (!currentRoute.isLoading()) {
                refreshSingleRoute(currentRoute);
            }
        }
	}
    return null;
    
}

function getCurrentDirectionObject (){
	var currentRoute = getCurrentRouteObject();
    if (currentRoute) {
        var directionList = currentRoute.getDirections();
        var l = directionList.length;
        var currentDirection;
        while(l--) {
            currentDirection = directionList[l];
            if(currentDirection.getDirectionTag() == $("#popupDirection").val()) {
                return currentDirection;
            }
        }
    }
    return null;
}

//
// Function: hide()
// Called when the widget has been hidden
//
function hide() {
    // Stop any timers to prevent CPU usage
}

//
// Function: load()
// Called by HTML body element's onload event when the widget is ready to start
//
function load() {
    dashcode.setupParts();
    timer = null;
    
	if (window.widget) {
		widgetId = widget.identifier; 

		// ROUTE
		if (widget.preferenceForKey(widgetId + '.routeTag') == undefined) {
			widget.setPreferenceForKey(DEF_ROUTE_TAG, widgetId + '.routeTag');
			widget.setPreferenceForKey(DEF_ROUTE_TITLE, widgetId + '.routeTitle');
		}
		if (widget.preferenceForKey(widgetId + '.routeTitle') == undefined) {
			widget.setPreferenceForKey(DEF_ROUTE_TAG, widgetId + '.routeTag');
			widget.setPreferenceForKey(DEF_ROUTE_TITLE, widgetId + '.routeTitle');
		}
		prefRouteTag = widget.preferenceForKey(widgetId + '.routeTag');
		prefRouteTitle = widget.preferenceForKey(widgetId + '.routeTitle');

		// DIRECTION
		if (widget.preferenceForKey(widgetId + '.directionTag') == undefined) {
			widget.setPreferenceForKey(DEF_DIR_TAG, widgetId + '.directionTag');
			widget.setPreferenceForKey(DEF_DIR_TITLE, widgetId + '.directionTitle');
		}
		if (widget.preferenceForKey(widgetId + '.directionTitle') == undefined) {
			widget.setPreferenceForKey(DEF_DIR_TAG, widgetId + '.directionTag');
			widget.setPreferenceForKey(DEF_DIR_TITLE, widgetId + '.directionTitle');
		}
		prefDirectionTag = widget.preferenceForKey(widgetId + '.directionTag');
		prefDirectionTitle = widget.preferenceForKey(widgetId + '.directionTitle');

		// STOP
		if (widget.preferenceForKey(widgetId + '.stopTag') == undefined) {
			widget.setPreferenceForKey(DEF_STOP_TAG, widgetId + '.stopTag');
			widget.setPreferenceForKey(DEF_STOP_TITLE, widgetId + '.stopTitle');
		}
		if (widget.preferenceForKey(widgetId + '.stopTitle') == undefined) {
			widget.setPreferenceForKey(DEF_STOP_TAG, widgetId + '.stopTag');
			widget.setPreferenceForKey(DEF_STOP_TITLE, widgetId + '.stopTitle');
		}
		prefStopTag = widget.preferenceForKey(widgetId + '.stopTag');
		prefStopTitle = widget.preferenceForKey(widgetId + '.stopTitle');

		
	} else {
        prefRouteTag = DEF_ROUTE_TAG;
        prefRouteTitle = DEF_ROUTE_TITLE;
        prefDirectionTag = DEF_DIR_TAG;
        prefDirectionTitle = DEF_DIR_TITLE;
        prefStopTag = DEF_STOP_TAG;
        prefStopTitle = DEF_STOP_TITLE;
	}
    
    $("#labelPrediction0").html("");
    $("#labelPrediction1").html("");
    $("#labelPrediction2").html("");
    $("#labelUpdate").html("");
    $("#labelTimestamp").html("");
    $("#version").html("v" + version);

    updateUIRoutes();
    checkVersion();
}

function log(eventString) {
    if (debug) {
        alert(eventString);
    }
}

function openInBrowser(event) {
    if (window.widget) {
        widget.openURL('http://www.wirelust.com');
    }
}

function openUpdateInBrowser(event) {
    if (window.widget) {
        widget.openURL('http://www.wirelust.com/mbta-bus-tracker-widget-for-osx/');
    }
}

function refreshRoutes() {
    if (!refreshRouteInProgress && !routesLoaded) {
        refreshRouteInProgress = true;
        $("#popupRoute").attr('disabled', true);
        $("#popupDirection").attr('disabled', true);
        $("#popupStop").attr('disabled', true);
        

        var xml_request = new XMLHttpRequest();
        var url = webserviceURLBase + "command=routeList";
        
        xml_request.onLoad = function(e) {
            //alert('onload');
        }
        xml_request.overrideMimeType("text/xml");
        
        xml_request.onreadystatechange=function() {
            if (xml_request.readyState==4) {
                refreshRoutesResponse(xml_request);
            }
        }
        //xml_request.setRequestHeader("Cache-Control", "no-cache");
        xml_request.open("GET", url);
        xml_request.send(null);
    }
}

function refreshSingleRoute(routeObj) {
    $("#popupDirection").attr('disabled', true);
    $("#popupStop").attr('disabled', true);

	var xml_request = new XMLHttpRequest();
	var url = webserviceURLBase + "command=routeConfig&r=" + routeObj.getRouteTag();
	
	xml_request.onLoad = function(e) {
		//alert('onload');
	}
	xml_request.overrideMimeType("text/xml");
	
	xml_request.onreadystatechange=function() {
		if (xml_request.readyState==4) {
			refreshSingleRouteResponse(routeObj, xml_request);
		}
	}
	//xml_request.setRequestHeader("Cache-Control", "no-cache");
    log("refreshing single route:" + url);
	xml_request.open("GET", url);
    routeObj.setLoading(true);
	xml_request.send(null);
}

function refreshRoutesResponse(request) {
    log("refreshing route list response");
	routeList = new Array();
    var responseXML = request.responseXML;
    var root = responseXML.getElementsByTagName('body')[0];
    var routes = responseXML.getElementsByTagName('route');
	titleList = new Array();

    for (var i=0; i<routes.length; i++) {
        var currentRoute = routes[i];
        
        var tempRoute = new Route();
        tempRoute.setRouteTag(currentRoute.getAttribute('tag'));
        tempRoute.setRouteTitle(currentRoute.getAttribute('title'));
        routeList.push(tempRoute);
    }
        

	//////////////////////////////////////////////////////////////////////////
	
	var routeLength = routeList.length;
	var routeHTML = '';
	var tag; var title;
	while(routeLength--){
		tag = routeList[routeLength].getRouteTag();
		title = routeList[routeLength].getRouteTitle();
		routeHTML += createOptionTag(tag, title);
	}
    if ($("#popupRoute")) {
        $("#popupRoute").html(routeHTML);
        $("#popupRoute").val(prefRouteTag);
        $("#popupRoute").attr('disabled', false);
        changeRoute();
    }
    routeRefreshInProgress = false;
    routesLoaded = true;
}

function refreshSingleRouteResponse(routeObj, request) {
    log("refreshing single route response:" + routeObj.getRouteTag());
    var responseXML = request.responseXML;
    if (!responseXML) {
        log("responseXML is null!");
    } else {
        //var rootXml = responseXML.getElementsByTagName('body')[0];
        var routes = responseXML.getElementsByTagName('route');
        titleList = new Array();

        for (var i=0; i<routes.length; i++) {
            var currentRoute = routes[i];
            var childNodes = currentRoute.childNodes;
            for (var r=0; r<childNodes.length; r++) {
                var child = childNodes[r];
                if (child.nodeName == "stop") {
                    var thisStop = child;
                    var thisStopId = thisStop.getAttribute('stopId');
                    
                    var stop = routeObj.getStopByTag(stopTag);
                        
                    if (stop == null) {
                        stop = new Stop();
                        routeObj.addStop(stop);
                    }
                    stop.setStopTag(thisStop.getAttribute('tag'));
                    stop.setStopTitle(thisStop.getAttribute('title'));
                    stop.setStopId(thisStop.getAttribute('stopId'));

                } else if (child.nodeName == "direction") {
                    // we only care about the direction tags so we can get the titles.
                    // dumb for boston since we only have two directions, but whateva.
                    thisDirTag = child.getAttribute('tag');
                    thisDirTitle = (child.getAttribute('title') == "" || child.getAttribute('title') == "null") ? child.getAttribute('name') : child.getAttribute('title');
                    
                    var tempDirection = routeObj.getDirectionByTag(thisDirTag);
                    if (tempDirection == null) {
                        if (child.getAttribute('useForUI') == "true") {
                            var tempDirection = new Direction();
                            tempDirection.setDirectionTag(thisDirTag);
                            tempDirection.setDirectionTitle(thisDirTitle);
                            routeObj.addDirection(tempDirection);
                        }
                    } else {
                        tempDirection.setDirectionTitle(thisDirTitle);
                    }
                    
                    var stopNodes = child.childNodes;
                    for (var s=0; s<stopNodes.length; s++) {
                        var stopXml = stopNodes[s];
                        if (stopXml.nodeType == 1) {
                            var stopTag = stopXml.getAttribute('tag');

                            stop = routeObj.getStopByTag(stopTag);
                            
                            if (stop == null) {
                                stop = new Stop();
                                stop.setStopTag(stopTag);
                                routeObj.addStop(stop);
                            }
                            
                            tempDirection.addStop(stop);                        
                        }
                    }
                }
            }
        }

        routeObj.setLoaded(true);
        routeObj.setLoading(false);
        changeRoute();
    }
}

function refreshTimes() {
    var sinceLastRefersh = new Date().getTime() - lastRefresh;
    if (sinceLastRefersh > timerInterval) {
        lastRefresh = new Date().getTime();
        var url = predictionURLBase + 'stopId=' + prefStopTag;
        var xml_request = new XMLHttpRequest();
        xml_request.overrideMimeType("text/xml");
        
        xml_request.onreadystatechange=function() {
            if (xml_request.readyState == 4) {
                responseXML = xml_request.responseXML;
                if (!responseXML) {
                    log("refreshTimes responseXML is null!");
                } else {
                    var predictions = responseXML.getElementsByTagName('prediction');

                    $("#labelPrediction0").html("");
                    $("#labelPrediction1").html("");
                    $("#labelPrediction2").html("");
                    for (var i=0; i<predictions.length; i++) {
                        mins = predictions[i].getAttribute('minutes');
                        time = (mins) ? mins + ' minutes' : 'Unknown';
                        if ($("#labelPrediction" + i)) {
                            $("#labelPrediction" + i).html(time);
                        }
                    }
            
                    if ($("#labelTimestamp")) {
                        $("#labelTimestamp").html(createTimeStamp());
                    }
                }            
            }
        }
        log("refreshing predictions with url:" + url);
        xml_request.setRequestHeader("Cache-Control", "no-cache");
        xml_request.open("GET", url);
        xml_request.send(null);
    }
}

//
// Function: remove()
// Called when the widget has been removed from the Dashboard
//
function remove() {
    // Stop any timers to prevent CPU usage
    // Remove any preferences as needed
    // widget.setPreferenceForKey(null, dashcode.createInstancePreferenceKey("your-key"));
}


//
// Function: show()
// Called when the widget has been shown
//
function show()
{
    // Restart any timers that were stopped on hide
    if (timer == null) {
        timer = setInterval(refreshTimes, timerInterval);
    }
    refreshTimes();
    
}

function savePrefs() {
    // If the stop has changed, it is okay to refresh the prediction now.
    if ($("#popupStop").val() && $("#popupStop").val() != null && $("#popupStop").val() != prefStopTag) {
        lastRefresh = 0;

        prefRouteTag = $("#popupRoute").val();
        prefRouteTitle = $("#popupRoute option:selected").text();

        //alert("route:" + prefRouteTag + " title:" + prefRouteTitle);
        if (window.widget) {
            widget.setPreferenceForKey(prefRouteTag, widgetId + '.routeTag');
            widget.setPreferenceForKey(prefRouteTitle, widgetId + '.routeTitle');
        }
        
        prefDirectionTag = $("#popupDirection").val();
        prefDirectionTitle = $("#popupDirection option:selected").text();

        //alert("direction:" + prefDirectionTag + " title:" + prefDirectionTitle);
        if (window.widget) {
            widget.setPreferenceForKey(prefDirectionTag, widgetId + '.directionTag');
            widget.setPreferenceForKey(prefDirectionTitle, widgetId + '.directionTitle');
        }
        
        prefStopTag = $("#popupStop").val();
        prefStopTitle = $("#popupStop option:selected").text();

        //alert("stop:" + prefStopTag + " title:" + prefStopTitle);
        if (window.widget) {
            widget.setPreferenceForKey(prefStopTag, widgetId + '.stopTag');
            widget.setPreferenceForKey(prefStopTitle, widgetId + '.stopTitle');
        }
        
        updateUIRoutes();
    }
}



//
// Function: sync()
// Called when the widget has been synchronized with .Mac
//
function sync()
{
    // Retrieve any preference values that you need to be synchronized here
    // Use this for an instance key's value:
    // instancePreferenceValue = widget.preferenceForKey(null, dashcode.createInstancePreferenceKey("your-key"));
    //
    // Or this for global key's value:
    // globalPreferenceValue = widget.preferenceForKey(null, "your-key");
}

//
// Function: showBack(event)
// Called when the info button is clicked to show the back of the widget
//
// event: onClick event from the info button
//
function showBack(event)
{
    var front = document.getElementById("front");
    var back = document.getElementById("back");

    if (window.widget) {
        widget.prepareForTransition("ToBack");
        refreshRoutes();
    }

    front.style.display = "none";
    back.style.display = "block";

    if (window.widget) {
        setTimeout('widget.performTransition();', 0);
    }
}

//
// Function: showFront(event)
// Called when the done button is clicked from the back of the widget
//
// event: onClick event from the done button
//
function showFront(event)
{
    var front = document.getElementById("front");
    var back = document.getElementById("back");

    if (window.widget) {
        widget.prepareForTransition("ToFront");
    }

    front.style.display="block";
    back.style.display="none";

    if (window.widget) {
        setTimeout('widget.performTransition();', 0);
    }
}

function updateUIRoutes() {
    $("#labelRoute").html("Route: " + prefRouteTitle);
    $("#labelDirection").html(prefDirectionTitle);
    $("#labelStop").html(prefStopTitle);
}


if (window.widget) {
    widget.onremove = remove;
    widget.onhide = hide;
    widget.onshow = show;
    widget.onsync = sync;
}

//===============================================================================================
// Config Objects
//===============================================================================================

//Route Object
Route = function() {
	this.$directions = new Array();
    this.$loaded = false;
    this.$loading = false;
    this.$stops = new Array();
}
Route.prototype.isLoaded = function(arg) {
	return this.$loaded;
}
Route.prototype.isLoading = function(arg) {
	return this.$loading;
}
Route.prototype.setLoaded = function(arg) {
    this.$loaded = arg;
}
Route.prototype.setLoading = function(arg) {
    this.$loading = arg;
}
Route.prototype.setRouteTag = function(arg) {
	this.$routeTag = arg;
}
Route.prototype.getRouteTag = function(arg) {
	return this.$routeTag;
}
Route.prototype.setRouteTitle = function(arg) {
	this.$routeTitle = arg;
}
Route.prototype.getRouteTitle = function(arg) {
	return this.$routeTitle;
}
Route.prototype.addDirection = function(arg) {
	this.$directions.push(arg);
}
Route.prototype.getDirections = function(arg) {
	return this.$directions;
}
Route.prototype.getDirectionByTag = function(arg) {
    for (var i=0; i<this.$directions.length; i++) {
        if (this.$directions[i].getDirectionTag() == arg) {
            return this.$directions[i];
        }
    }
    return null;
}
Route.prototype.addStop = function(arg) {
	this.$stops.push(arg);
}
Route.prototype.getStops = function(arg) {
	return this.$stops;
}
Route.prototype.getStopByTag = function(arg) {
    for (var i=0; i<this.$stops.length; i++) {
        if (this.$stops[i].getStopTag() == arg) {
            return this.$stops[i];
        }
    }
    return null;
}


//Direction Object
Direction = function() {
	this.$stops = new Array();
}
Direction.prototype.setDirectionTag = function(arg) {
	this.$directionTag = arg;
}
Direction.prototype.getDirectionTag = function(arg) {
	return this.$directionTag;
}
Direction.prototype.setDirectionTitle = function(arg) {
	this.$directionTitle = arg;
}
Direction.prototype.getDirectionTitle = function(arg) {
	return this.$directionTitle;
}
Direction.prototype.addStop = function(arg) {
	this.$stops.push(arg);
}
Direction.prototype.getStops = function(arg) {
	return this.$stops;
}

//Stop Object
Stop = function() {}
Stop.prototype.setStopId = function(arg) {
	this.$stopId = arg;
}
Stop.prototype.getStopId = function(arg) {
	return this.$stopId;
}
Stop.prototype.setStopTag = function(arg) {
	this.$stopTag = arg;
}
Stop.prototype.getStopTag = function(arg) {
	return this.$stopTag;
}
Stop.prototype.setStopTitle = function(arg) {
	this.$stopTitle = arg;
}
Stop.prototype.getStopTitle = function(arg) {
    return this.$stopTitle;
}



