/*\
title: $:/core/modules/startup/confirm.js
type: application/javascript
module-type: startup

Handles the answers to confirmation questions

\*/

"use strict";

// Export name and synchronous status
exports.name = "confirm";
exports.after = ["startup"];
exports.synchronous = true;

exports.startup = function() {
	$tw.rootWidget.addEventListener("tm-confirm",function(event) {
		var paramObject = event.paramObject || {},
			wiki = event.widget ? event.widget.wiki : $tw.wiki;
		$tw.utils.answerConfirmation(wiki,event.param,paramObject.answer === "yes");
		return false;
	});
};
