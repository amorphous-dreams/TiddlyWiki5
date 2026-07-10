/*\
title: test-resilient-render.js
type: application/javascript
tags: [[$:/tags/test-spec]]

Tests the resilient render boundary in widget.js renderChildren. A child widget that throws degrades
to a graded `tc-error` span, the throwing child is replaced and tracked in this.children, and later
siblings still render. TranscludeRecursionError still climbs so the recursion handler keeps control.

\*/

"use strict";

describe("Resilient render boundary", function() {

	var widget = require("$:/core/modules/widgets/widget.js");

	function createWidgetNode(parseTreeNode,wiki) {
		return new widget.widget(parseTreeNode,{
			wiki: wiki,
			document: $tw.fakeDocument
		});
	}

	function renderWidgetNode(widgetNode) {
		$tw.fakeDocument.setSequenceNumber(0);
		var wrapper = $tw.fakeDocument.createElement("div");
		widgetNode.render(wrapper,null);
		return wrapper;
	}

	// Register a widget whose render() throws, run fn, then clean up so no other spec sees it.
	function withThrowWidget(fn,errorFactory) {
		function ThrowWidget(parseTreeNode,options) { widget.widget.call(this,parseTreeNode,options); }
		ThrowWidget.prototype = Object.create(widget.widget.prototype);
		ThrowWidget.prototype.render = function() { throw errorFactory ? errorFactory() : new Error("boom"); };
		var classes = widget.widget.prototype.widgetClasses;
		var had = Object.prototype.hasOwnProperty.call(classes,"throwtest"),
			previousClass = classes["throwtest"];
		classes["throwtest"] = ThrowWidget;
		try {
			fn();
		} finally{
			if(had) {
				classes["throwtest"] = previousClass;
			} else {
				delete classes["throwtest"];
			}
		}
	}

	var parseTreeNode = {type: "widget", children: [
		{type: "throwtest"},
		{type: "text", text: "survived"}
	]};

	it("degrades a throwing child to a tc-error span", function() {
		withThrowWidget(function() {
			var wiki = new $tw.Wiki();
			var widgetNode = createWidgetNode(parseTreeNode,wiki);
			var wrapper;
			// The render must NOT propagate the throw...
			expect(function() {
				wrapper = renderWidgetNode(widgetNode);
			}).not.toThrow();
			// ...the throwing child became a graded tc-error span...
			expect(wrapper.innerHTML).toContain("tc-error");
			expect(wrapper.innerHTML).toContain("Widget render error");
			// ...the later sibling still rendered...
			expect(wrapper.innerHTML).toContain("survived");
			// ...and the throwing child was replaced + tracked in this.children (no orphan/leak).
			expect(widgetNode.children[0].parseTreeNode.type).toBe("error");
		});
	});

	it("degrades repeated throwing children independently", function() {
		withThrowWidget(function() {
			var wiki = new $tw.Wiki(),
				widgetNode,
				wrapper;
			widgetNode = createWidgetNode({type: "widget", children: [
				{type: "throwtest"},
				{type: "throwtest"},
				{type: "text", text: "survived"}
			]},wiki);
			expect(function() {
				wrapper = renderWidgetNode(widgetNode);
			}).not.toThrow();
			expect(wrapper.innerHTML.split("Widget render error").length - 1).toBe(2);
			expect(wrapper.innerHTML).toContain("survived");
		});
	});

	it("lets transclude recursion errors climb", function() {
		withThrowWidget(function() {
			var wiki = new $tw.Wiki();
			expect(function() {
				renderWidgetNode(createWidgetNode(parseTreeNode,wiki));
			}).toThrow();
		},function() {
			return new $tw.utils.TranscludeRecursionError();
		});
	});

	// A widget that renders fine but throws on a LATER refresh (the live-update path that
	// island-worker → browser-DOM projection depends on).
	function withRefreshThrowWidget(fn) {
		function RefreshThrowWidget(parseTreeNode,options) { widget.widget.call(this,parseTreeNode,options); }
		RefreshThrowWidget.prototype = Object.create(widget.widget.prototype);
		RefreshThrowWidget.prototype.render = function(parent,nextSibling) {
			this.parentDomNode = parent;
			var node = this.document.createElement("span");
			node.appendChild(this.document.createTextNode("ok-before"));
			parent.insertBefore(node,nextSibling);
			this.domNodes = [node];
		};
		RefreshThrowWidget.prototype.refresh = function() { throw new Error("refresh boom"); };
		var classes = widget.widget.prototype.widgetClasses;
		var had = Object.prototype.hasOwnProperty.call(classes,"refreshthrow"),
			previousClass = classes["refreshthrow"];
		classes["refreshthrow"] = RefreshThrowWidget;
		try {
			fn();
		} finally{
			if(had) {
				classes["refreshthrow"] = previousClass;
			} else {
				delete classes["refreshthrow"];
			}
		}
	}

	it("degrades a child that throws on refresh (live-update resilience)", function() {
		withRefreshThrowWidget(function() {
			var wiki = new $tw.Wiki();
			var widgetNode = createWidgetNode({type: "widget", children: [{type: "refreshthrow"}]},wiki);
			var wrapper = renderWidgetNode(widgetNode);
			expect(wrapper.innerHTML).toContain("ok-before"); // rendered fine first
			// The refresh must NOT propagate the throw...
			expect(function() {
				widgetNode.refresh({});
			}).not.toThrow();
			// ...the child that threw on refresh became a tc-error span...
			expect(wrapper.innerHTML).toContain("tc-error");
			// ...and was replaced + tracked.
			expect(widgetNode.children[0].parseTreeNode.type).toBe("error");
		});
	});
});
