/*\
title: $:/perf/tests/search-at-scale.js
type: application/javascript
tags: [[$:/tags/performance-test]]

Measures full-text search cost over a large tiddler set — the community's most-reported scale wall. Search is un-indexed: every query scans every tiddler's title, tags and text. Progressive queries model per-keystroke cost, and an indexed-tag arm shows the cheaper alternative.

\*/

"use strict";

exports.name = "search-at-scale";
exports.platform = "both";
exports.warmup = 2;
exports.iterations = 10;

var WORDS = ["detail","design","render","widget","filter","tiddler","project","status","report","archive","content","search","refresh","macro","transclude","paragraph"];

exports.run = function(context) {
	var wiki = context.wiki,
		count = 5000,
		prefix = "$:/temp/perftest/search/item-",
		measurements = [];
	seed(wiki,prefix,count);
	try {
		var battery = [
			{id: "search-broad", filter: "[all[tiddlers]search[e]]", note: "one-character query: scans every tiddler, matches most (early-keystroke worst case)"},
			{id: "search-narrowing", filter: "[all[tiddlers]search[design]]", note: "specific word: full scan, few matches (typical query)"},
			{id: "search-title-only", filter: "[all[tiddlers]search:title[item]]", note: "title-only search: scans titles, skips body"},
			{id: "search-vs-indexed-tag", filter: "[tag[perfitem-common]]", note: "the indexed alternative: an O(1) tag lookup instead of a scan"}
		];
		for(var i = 0; i < battery.length; i++) {
			measurements.push(measureFilter(context,count,battery[i]));
		}
	} finally {
		cleanup(wiki,prefix,count);
	}
	return measurements;
};

function measureFilter(context,count,spec) {
	var wiki = context.wiki,
		results = [];
	return context.measure(spec.id,function() {
		results = wiki.filterTiddlers(spec.filter);
		return {
			mode: "main",
			phase: "search",
			taxonomy: "search",
			scenarioId: spec.id,
			scenarioDescription: spec.note,
			fixtureName: "search-at-scale",
			fixtureItemCount: count,
			resultCount: results.length,
			filterString: spec.filter
		};
	});
}

function seed(wiki,prefix,count) {
	for(var i = 0; i < count; i++) {
		var body = [];
		for(var w = 0; w < 12; w++) {
			body.push(WORDS[(i + w * 7) % WORDS.length]);
		}
		wiki.addTiddler(new $tw.Tiddler({
			title: prefix + i,
			tags: ["perfitem-common"],
			text: "Item " + i + ": " + body.join(" ") + "."
		}));
	}
	wiki.clearTiddlerEventQueue();
}

function cleanup(wiki,prefix,count) {
	for(var i = 0; i < count; i++) {
		wiki.deleteTiddler(prefix + i);
	}
	wiki.clearTiddlerEventQueue();
}
