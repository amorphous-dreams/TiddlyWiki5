/*\
title: $:/core/modules/widgets/dialog.js
type: application/javascript
module-type: widget

Dialog widget: displays its content as a modal dialog, making the rest of the page inert

\*/

"use strict";

var Widget = require("$:/core/modules/widgets/widget.js").widget;

var FOCUSABLE_SELECTOR = "button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])";

function isInert(node) {
	var value = node.getAttribute("inert");
	return value !== null && value !== undefined;
}

var DialogWidget = function(parseTreeNode,options) {
	this.initialise(parseTreeNode,options);
};

/*
Inherit from the base widget class
*/
DialogWidget.prototype = new Widget();

/*
Render this widget into the DOM
*/
DialogWidget.prototype.render = function(parent,nextSibling) {
	// Remember parent
	this.parentDomNode = parent;
	// Compute attributes and execute state
	this.computeAttributes();
	this.execute();
	// Create element
	var domNode = this.document.createElement("div");
	domNode.className = this.dialogClass;
	domNode.setAttribute("role",this.dialogRole);
	domNode.setAttribute("aria-modal","true");
	domNode.setAttribute("tabindex","-1");
	this.assignAttributes(domNode,{
		sourcePrefix: "aria-",
		destPrefix: "aria-"
	});
	// Insert element
	parent.insertBefore(domNode,nextSibling);
	this.renderChildren(domNode,null);
	this.domNodes.push(domNode);
	// Make the rest of the page inert
	this.inertNodes = [];
	this.isDisplayed = true;
	this.updateInertNodes();
	// Move the focus into the dialog, remembering where it was
	this.focusedNode = this.document.activeElement;
	var focusNode = domNode.querySelector ? (domNode.querySelector(FOCUSABLE_SELECTOR) || domNode) : domNode;
	if(focusNode.focus) {
		focusNode.focus();
	}
};

/*
Compute the internal state of the widget
*/
DialogWidget.prototype.execute = function() {
	this.dialogClass = this.getAttribute("class","");
	this.dialogRole = this.getAttribute("role","dialog");
	// Make child widgets
	this.makeChildWidgets();
};

/*
Mark as inert the siblings of the dialog and of each of its ancestors
*/
DialogWidget.prototype.updateInertNodes = function() {
	var self = this;
	// Mark again once the current refresh cycle has finished rendering
	if(!this.isUpdatePending) {
		this.isUpdatePending = true;
		$tw.utils.nextTick(function() {
			self.isUpdatePending = false;
			if(self.isDisplayed) {
				self.markInertNodes();
			}
		});
	}
	this.markInertNodes();
};

DialogWidget.prototype.markInertNodes = function() {
	var node = this.domNodes[0];
	while(node && node.parentNode && node !== this.document.body) {
		var siblings = node.parentNode.children;
		for(var t=0; t<siblings.length; t++) {
			var sibling = siblings[t];
			if(sibling !== node && sibling.nodeType === 1 && !sibling.isRaw && !isInert(sibling)) {
				sibling.setAttribute("inert","");
				this.inertNodes.push(sibling);
			}
		}
		node = node.parentNode;
	}
};

/*
Selectively refreshes the widget if needed. Returns true if the widget or any of its children needed re-rendering
*/
DialogWidget.prototype.refresh = function(changedTiddlers) {
	var changedAttributes = this.computeAttributes();
	if(changedAttributes["class"] || changedAttributes.role) {
		this.refreshSelf();
		return true;
	}
	this.assignAttributes(this.domNodes[0],{
		changedAttributes: changedAttributes,
		sourcePrefix: "aria-",
		destPrefix: "aria-"
	});
	var refreshed = this.refreshChildren(changedTiddlers);
	// Mark any nodes that have been rendered since
	this.updateInertNodes();
	return refreshed;
};

/*
Restore the rest of the page when the dialog is removed
*/
DialogWidget.prototype.onDestroy = function() {
	this.isDisplayed = false;
	$tw.utils.each(this.inertNodes,function(node) {
		node.removeAttribute("inert");
	});
	this.inertNodes = [];
	if(this.focusedNode && this.focusedNode.focus && this.focusedNode.isConnected !== false) {
		this.focusedNode.focus();
	}
	this.focusedNode = null;
};

exports.dialog = DialogWidget;
