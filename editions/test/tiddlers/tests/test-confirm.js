/*\
title: test-confirm.js
type: application/javascript
tags: [[$:/tags/test-spec]]

Tests the confirmation questions asked through $tw.utils.confirm, their answers and their display.

\*/

"use strict";

describe("Confirmation tests", function() {

	var QUESTION_TAG = "$:/tags/Confirmation",
		ALERT_TITLE = "$:/temp/alerts/confirm";

	function findNavigator(widget) {
		if(widget.handleDeleteTiddlerEvent) {
			return widget;
		}
		var result;
		$tw.utils.each(widget.children,function(child) {
			result = result || findNavigator(child);
		});
		return result;
	}

	function setupNavigator(tiddlers) {
		var wiki = new $tw.Wiki();
		wiki.addTiddlers(tiddlers);
		wiki.addTiddler({title: "$:/StoryList", list: "HelloThere"});
		var widgetNode = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki","<$navigator story='$:/StoryList' history='$:/HistoryList'/>"),{document: $tw.fakeDocument, parentWidget: $tw.rootWidget});
		widgetNode.render($tw.fakeDocument.createElement("div"),null);
		return {
			wiki: wiki,
			navigator: findNavigator(widgetNode)
		};
	}

	function setupActions() {
		var wiki = new $tw.Wiki();
		wiki.addTiddler({title: "Root", text: "Some dummy content"});
		var widgetNode = wiki.makeTranscludeWidget("Root",{document: $tw.fakeDocument, parseAsInline: true, parentWidget: $tw.rootWidget});
		widgetNode.render($tw.fakeDocument.createElement("div"),null);
		return {
			wiki: wiki,
			widgetNode: widgetNode
		};
	}

	function getQuestions(wiki) {
		return wiki.getTiddlersWithTag(QUESTION_TAG);
	}

	function getQuestion(wiki) {
		var titles = getQuestions(wiki);
		expect(titles.length).toBe(1);
		return wiki.getTiddler(titles[0]);
	}

	// Answer through the same message that the buttons of the question send
	function answer(info,title,answer) {
		(info.navigator || info.widgetNode).dispatchEvent({type: "tm-confirm", param: title, paramObject: {answer: answer}});
	}

	function getAlertText(wiki) {
		return wiki.getTiddlerText(ALERT_TITLE);
	}

	it("should store the question and decline until it is answered", function() {
		var info = setupNavigator([{title: "HelloThere", text: "Some text"}]);
		info.navigator.dispatchEvent({type: "tm-delete-tiddler", tiddlerTitle: "HelloThere"});
		expect(info.wiki.tiddlerExists("HelloThere")).toBe(true);
		var question = getQuestion(info.wiki);
		expect(question.fields.title.indexOf("$:/temp/confirm/")).toBe(0);
		expect(question.fields.text).toBe($tw.language.getString("ConfirmDeleteTiddler",{variables: {title: "HelloThere"}}));
		expect(question.fields["confirm-type"]).toBe("delete");
		expect(question.fields["confirm-title"]).toBe("HelloThere");
		expect(info.wiki.getTiddler("$:/StoryList").fields.list).toEqual(["HelloThere"]);
	});

	it("should repeat the action when the question is confirmed", function() {
		var info = setupNavigator([{title: "HelloThere", text: "Some text"}]);
		info.navigator.dispatchEvent({type: "tm-delete-tiddler", tiddlerTitle: "HelloThere"});
		answer(info,getQuestion(info.wiki).fields.title,"yes");
		expect(info.wiki.tiddlerExists("HelloThere")).toBe(false);
		expect(getQuestions(info.wiki)).toEqual([]);
		expect(getAlertText(info.wiki)).toBe(undefined);
		expect(info.wiki.getTiddler("$:/StoryList").fields.list).toEqual([]);
	});

	it("should leave everything in place when the question is declined", function() {
		var info = setupNavigator([{title: "HelloThere", text: "Some text"}]);
		info.navigator.dispatchEvent({type: "tm-delete-tiddler", tiddlerTitle: "HelloThere"});
		var title = getQuestion(info.wiki).fields.title;
		answer(info,title,"no");
		expect(info.wiki.getTiddlerText("HelloThere")).toBe("Some text");
		expect(getQuestions(info.wiki)).toEqual([]);
		expect(getAlertText(info.wiki)).toBe(undefined);
		// A later confirmation of the declined question does nothing
		answer(info,title,"yes");
		expect(info.wiki.getTiddlerText("HelloThere")).toBe("Some text");
		expect(getAlertText(info.wiki)).toBe($tw.language.getString("ConfirmationWithdrawn"));
	});

	it("should not ask before deleting an empty tiddler", function() {
		var info = setupNavigator([{title: "HelloThere"}]);
		info.navigator.dispatchEvent({type: "tm-delete-tiddler", tiddlerTitle: "HelloThere"});
		expect(info.wiki.tiddlerExists("HelloThere")).toBe(false);
		expect(getQuestions(info.wiki)).toEqual([]);
	});

	it("should handle navigator messages that carry no DOM event", function() {
		var info = setupNavigator([{title: "HelloThere", text: "Some text"}]);
		info.navigator.dispatchEvent({type: "tm-edit-tiddler", tiddlerTitle: "HelloThere"});
		var draftTitle = info.wiki.findDraft("HelloThere");
		expect(draftTitle).toBe("Draft of 'HelloThere'");
		info.wiki.addTiddler(new $tw.Tiddler(info.wiki.getTiddler(draftTitle),{text: "New text"}));
		info.navigator.dispatchEvent({type: "tm-save-tiddler", tiddlerTitle: draftTitle});
		expect(info.wiki.getTiddlerText("HelloThere")).toBe("New text");
		expect(info.wiki.tiddlerExists(draftTitle)).toBe(false);
		expect(getQuestions(info.wiki)).toEqual([]);
	});

	it("should refuse a confirmation if the tiddlers have changed since the question was asked", function() {
		var info = setupNavigator([{title: "HelloThere", text: "Some text"}]);
		info.navigator.dispatchEvent({type: "tm-delete-tiddler", tiddlerTitle: "HelloThere"});
		info.wiki.addTiddler({title: "HelloThere", text: "Different text"});
		answer(info,getQuestion(info.wiki).fields.title,"yes");
		expect(info.wiki.getTiddlerText("HelloThere")).toBe("Different text");
		expect(getQuestions(info.wiki)).toEqual([]);
		expect(getAlertText(info.wiki)).toBe($tw.language.getString("ConfirmationChanged"));
		expect(info.wiki.getTiddler(ALERT_TITLE).fields.tags).toEqual(["$:/tags/Alert"]);
	});

	it("should ignore changes to the fields listed in $:/config/ConfirmIgnoredFields", function() {
		var info = setupNavigator([{title: "HelloThere", text: "Some text"},{title: "$:/config/ConfirmIgnoredFields", text: "revision [[other field]]"}]);
		info.navigator.dispatchEvent({type: "tm-delete-tiddler", tiddlerTitle: "HelloThere"});
		info.wiki.addTiddler({title: "HelloThere", text: "Some text", revision: "2"});
		answer(info,getQuestion(info.wiki).fields.title,"yes");
		expect(info.wiki.tiddlerExists("HelloThere")).toBe(false);
		expect(getAlertText(info.wiki)).toBe(undefined);
	});

	it("should refuse a confirmation if a tiddler has appeared since the question was asked", function() {
		var info = setupNavigator([
			{title: "Existing", text: "Existing text"},
			{title: "Draft of 'New'", "draft.of": "New", "draft.title": "New", text: "New text"}
		]);
		info.navigator.dispatchEvent({type: "tm-cancel-tiddler", tiddlerTitle: "Draft of 'New'"});
		info.wiki.addTiddler({title: "New", text: "Arrived"});
		answer(info,getQuestion(info.wiki).fields.title,"yes");
		expect(info.wiki.tiddlerExists("Draft of 'New'")).toBe(true);
		expect(getAlertText(info.wiki)).toBe($tw.language.getString("ConfirmationChanged"));
	});

	it("should withdraw an earlier question when another is asked", function() {
		var info = setupNavigator([{title: "HelloThere", text: "Some text"},{title: "Another", text: "More text"}]);
		info.navigator.dispatchEvent({type: "tm-delete-tiddler", tiddlerTitle: "HelloThere"});
		var first = getQuestion(info.wiki).fields.title;
		info.navigator.dispatchEvent({type: "tm-delete-tiddler", tiddlerTitle: "Another"});
		var second = getQuestion(info.wiki).fields.title;
		expect(second).not.toBe(first);
		answer(info,first,"yes");
		expect(info.wiki.tiddlerExists("HelloThere")).toBe(true);
		expect(info.wiki.tiddlerExists("Another")).toBe(true);
		expect(getAlertText(info.wiki)).toBe($tw.language.getString("ConfirmationWithdrawn"));
		expect(getQuestion(info.wiki).fields.title).toBe(second);
		answer(info,second,"yes");
		expect(info.wiki.tiddlerExists("Another")).toBe(false);
		expect(info.wiki.tiddlerExists("HelloThere")).toBe(true);
	});

	it("should refuse a confirmation of a question whose tiddler has been deleted", function() {
		var info = setupNavigator([{title: "HelloThere", text: "Some text"}]);
		info.navigator.dispatchEvent({type: "tm-delete-tiddler", tiddlerTitle: "HelloThere"});
		var title = getQuestion(info.wiki).fields.title;
		info.wiki.deleteTiddler(title);
		answer(info,title,"yes");
		expect(info.wiki.tiddlerExists("HelloThere")).toBe(true);
		expect(getAlertText(info.wiki)).toBe($tw.language.getString("ConfirmationWithdrawn"));
	});

	it("should confirm a question only once", function() {
		var info = setupActions(),
			answers = [];
		info.widgetNode.addEventListener("tm-test",function(event) {
			var options = {type: "action", widget: info.widgetNode, event: event};
			answers.push($tw.utils.confirm("Really?",options));
			answers.push($tw.utils.confirm("Really?",options));
			return false;
		});
		info.widgetNode.dispatchEvent({type: "tm-test"});
		expect(answers).toEqual([false,false]);
		answers = [];
		answer(info,getQuestion(info.wiki).fields.title,"yes");
		expect(answers).toEqual([true,false]);
		expect(getQuestion(info.wiki).fields.text).toBe("Really?");
	});

	it("should refuse a confirmation of a question that was never asked", function() {
		var info = setupNavigator([{title: "HelloThere", text: "Some text"}]);
		info.wiki.addTiddler({title: "$:/temp/confirm/forged", tags: [QUESTION_TAG], text: "Forged"});
		answer(info,"$:/temp/confirm/forged","yes");
		expect(info.wiki.tiddlerExists("HelloThere")).toBe(true);
		expect(info.wiki.tiddlerExists("$:/temp/confirm/forged")).toBe(false);
		expect(getAlertText(info.wiki)).toBe($tw.language.getString("ConfirmationWithdrawn"));
	});

	it("should ask before editing a shadow tiddler", function() {
		var info = setupNavigator([]);
		info.wiki.isShadowTiddler = function(title) {
			return title === "$:/ShadowTiddler";
		};
		info.navigator.dispatchEvent({type: "tm-edit-tiddler", tiddlerTitle: "$:/ShadowTiddler"});
		var question = getQuestion(info.wiki);
		expect(question.fields["confirm-type"]).toBe("edit-shadow");
		expect(question.fields.text).toBe($tw.language.getString("ConfirmEditShadowTiddler",{variables: {title: "$:/ShadowTiddler"}}));
		expect(info.wiki.findDraft("$:/ShadowTiddler")).toBe(undefined);
		answer(info,question.fields.title,"yes");
		expect(info.wiki.findDraft("$:/ShadowTiddler")).toBe("Draft of '$:/ShadowTiddler'");
	});

	it("should ask before saving a renamed draft over an existing tiddler", function() {
		var info = setupNavigator([
			{title: "HelloThere", text: "Some text"},
			{title: "Existing", text: "Existing text"},
			{title: "Draft of 'HelloThere'", "draft.of": "HelloThere", "draft.title": "Existing", text: "New text"}
		]);
		info.navigator.dispatchEvent({type: "tm-save-tiddler", tiddlerTitle: "Draft of 'HelloThere'"});
		var question = getQuestion(info.wiki);
		expect(question.fields["confirm-type"]).toBe("overwrite");
		expect(question.fields["confirm-title"]).toBe("Existing");
		expect(info.wiki.getTiddlerText("Existing")).toBe("Existing text");
		expect(info.wiki.tiddlerExists("Draft of 'HelloThere'")).toBe(true);
		answer(info,question.fields.title,"yes");
		expect(info.wiki.getTiddlerText("Existing")).toBe("New text");
		expect(info.wiki.tiddlerExists("Draft of 'HelloThere'")).toBe(false);
		expect(info.wiki.tiddlerExists("HelloThere")).toBe(false);
	});

	it("should refuse to overwrite a tiddler that has changed since the question was asked", function() {
		var info = setupNavigator([
			{title: "HelloThere", text: "Some text"},
			{title: "Existing", text: "Existing text"},
			{title: "Draft of 'HelloThere'", "draft.of": "HelloThere", "draft.title": "Existing", text: "New text"}
		]);
		info.navigator.dispatchEvent({type: "tm-save-tiddler", tiddlerTitle: "Draft of 'HelloThere'"});
		info.wiki.addTiddler({title: "Existing", text: "Newer text"});
		answer(info,getQuestion(info.wiki).fields.title,"yes");
		expect(info.wiki.getTiddlerText("Existing")).toBe("Newer text");
		expect(info.wiki.tiddlerExists("Draft of 'HelloThere'")).toBe(true);
		expect(getAlertText(info.wiki)).toBe($tw.language.getString("ConfirmationChanged"));
	});

	it("should ask before cancelling a modified draft", function() {
		var info = setupNavigator([
			{title: "HelloThere", text: "Some text"},
			{title: "Draft of 'HelloThere'", "draft.of": "HelloThere", "draft.title": "HelloThere", text: "New text"}
		]);
		info.navigator.dispatchEvent({type: "tm-cancel-tiddler", tiddlerTitle: "Draft of 'HelloThere'"});
		var question = getQuestion(info.wiki);
		expect(question.fields["confirm-type"]).toBe("cancel");
		expect(info.wiki.tiddlerExists("Draft of 'HelloThere'")).toBe(true);
		answer(info,question.fields.title,"yes");
		expect(info.wiki.tiddlerExists("Draft of 'HelloThere'")).toBe(false);
		expect(info.wiki.getTiddlerText("HelloThere")).toBe("Some text");
	});

	it("should not ask before cancelling an unmodified draft", function() {
		var info = setupNavigator([
			{title: "HelloThere", text: "Some text"},
			{title: "Draft of 'HelloThere'", "draft.of": "HelloThere", "draft.title": "HelloThere", text: "Some text"}
		]);
		info.navigator.dispatchEvent({type: "tm-cancel-tiddler", tiddlerTitle: "Draft of 'HelloThere'"});
		expect(info.wiki.tiddlerExists("Draft of 'HelloThere'")).toBe(false);
		expect(getQuestions(info.wiki)).toEqual([]);
	});

	it("should ask before invoking the actions of the action-confirm widget", function() {
		var info = setupActions(),
			actions = "<$action-setfield $tiddler='Before' text='done'/><$action-confirm $message='Really?'><$action-setfield $tiddler='Output' text='done'/></$action-confirm>";
		info.widgetNode.invokeActionString(actions,info.widgetNode,null,{});
		var question = getQuestion(info.wiki);
		expect(question.fields["confirm-type"]).toBe("action");
		expect(question.fields.text).toBe("Really?");
		expect(info.wiki.getTiddlerText("Before")).toBe("done");
		expect(info.wiki.tiddlerExists("Output")).toBe(false);
		// The actions before the question are not repeated
		info.wiki.deleteTiddler("Before");
		answer(info,question.fields.title,"yes");
		expect(info.wiki.getTiddlerText("Output")).toBe("done");
		expect(info.wiki.tiddlerExists("Before")).toBe(false);
		expect(getQuestions(info.wiki)).toEqual([]);
	});

	it("should not invoke the actions of the action-confirm widget when declined", function() {
		var info = setupActions();
		info.widgetNode.invokeActionString("<$action-confirm><$action-setfield $tiddler='Output' text='done'/></$action-confirm>",info.widgetNode,null,{});
		var question = getQuestion(info.wiki);
		expect(question.fields.text).toBe($tw.language.getString("ConfirmAction"));
		answer(info,question.fields.title,"no");
		expect(info.wiki.tiddlerExists("Output")).toBe(false);
		expect(getQuestions(info.wiki)).toEqual([]);
	});

	it("should not ask if the action-confirm widget has its prompt disabled", function() {
		var info = setupActions();
		info.widgetNode.invokeActionString("<$action-confirm $prompt='no'><$action-setfield $tiddler='Output' text='done'/></$action-confirm>",info.widgetNode,null,{});
		expect(getQuestions(info.wiki)).toEqual([]);
		expect(info.wiki.getTiddlerText("Output")).toBe("done");
	});

	it("should ask each nested question in turn", function() {
		var info = setupActions(),
			actions = "<$action-confirm $message='First?'><$action-confirm $message='Second?'><$action-setfield $tiddler='Output' text='done'/></$action-confirm></$action-confirm>";
		info.widgetNode.invokeActionString(actions,info.widgetNode,null,{});
		expect(getQuestion(info.wiki).fields.text).toBe("First?");
		answer(info,getQuestion(info.wiki).fields.title,"yes");
		expect(getQuestion(info.wiki).fields.text).toBe("Second?");
		expect(info.wiki.tiddlerExists("Output")).toBe(false);
		answer(info,getQuestion(info.wiki).fields.title,"yes");
		expect(info.wiki.getTiddlerText("Output")).toBe("done");
		expect(getQuestions(info.wiki)).toEqual([]);
	});

	it("should keep questions out of the saved and synced tiddlers", function() {
		var wiki = new $tw.Wiki();
		wiki.addTiddlers([
			{title: "$:/temp/confirm/1", tags: [QUESTION_TAG], text: "Really?"},
			{title: "$:/temp/alerts/confirm", tags: ["$:/tags/Alert"], text: "Refused"},
			{title: "HelloThere", text: "Some text"}
		]);
		expect(wiki.filterTiddlers($tw.wiki.getTiddlerText("$:/config/SyncFilter"))).toEqual(["HelloThere"]);
		expect(wiki.filterTiddlers($tw.wiki.getTiddlerText("$:/config/SaverFilter"))).toEqual(["HelloThere"]);
	});

	describe("display", function() {

		function setupDisplay() {
			var wiki = new $tw.Wiki();
			wiki.addTiddler({title: "Root", text: "<div class='page'><$button class='page-button'>Press</$button></div>{{$:/core/ui/Confirmations}}"});
			$tw.utils.each(["$:/core/ui/Confirmations","$:/core/ui/ConfirmTemplate","$:/language/Yes","$:/language/No","$:/language/Confirmation/Caption","$:/language/Confirmation/delete/Yes","$:/language/Confirmation/delete/No"],function(title) {
				wiki.addTiddler($tw.wiki.getTiddler(title));
			});
			var widgetNode = wiki.makeTranscludeWidget("Root",{document: $tw.fakeDocument, parentWidget: $tw.rootWidget}),
				container = $tw.fakeDocument.createElement("div");
			widgetNode.render(container,null);
			return {
				wiki: wiki,
				widgetNode: widgetNode,
				container: container,
				refresh: function(changes) {
					widgetNode.refresh(changes,container,null);
				}
			};
		}

		function findNode(node,test) {
			if(test(node)) {
				return node;
			}
			var result;
			$tw.utils.each(node.children,function(child) {
				result = result || findNode(child,test);
			});
			return result;
		}

		function findByClass(node,className) {
			return findNode(node,function(node) {
				return !!node.className && node.className.split(" ").indexOf(className) !== -1;
			});
		}

		function ask(info,type) {
			var changes = {};
			$tw.utils.confirm("Do you wish to delete the tiddler \"<b>HelloThere</b>\"?",{type: type, title: "HelloThere", widget: info.widgetNode, event: {type: "tm-test"}});
			changes[info.wiki.getTiddlersWithTag(QUESTION_TAG)[0]] = {modified: true};
			info.refresh(changes);
		}

		it("should render nothing while no question is waiting", function() {
			var info = setupDisplay();
			expect(findByClass(info.container,"tc-confirm")).toBe(undefined);
			expect(findByClass(info.container,"page").getAttribute("inert")).toBe(undefined);
		});

		it("should render the question as a modal alert dialog with the message as text", function() {
			var info = setupDisplay();
			ask(info,"delete");
			var dialog = findByClass(info.container,"tc-confirm");
			expect(dialog.getAttribute("role")).toBe("alertdialog");
			expect(dialog.getAttribute("aria-modal")).toBe("true");
			expect(dialog.getAttribute("aria-label")).toBe("Confirmation");
			expect(dialog.getAttribute("aria-describedby")).toBe("tc-confirm-message");
			var message = findByClass(dialog,"tc-confirm-message");
			expect(message.getAttribute("id")).toBe("tc-confirm-message");
			expect(message.textContent).toBe("Do you wish to delete the tiddler \"<b>HelloThere</b>\"?");
			expect(message.innerHTML).toBe("Do you wish to delete the tiddler \"&lt;b&gt;HelloThere&lt;/b&gt;\"?");
		});

		it("should offer the declining button first, worded for the kind of question", function() {
			var info = setupDisplay();
			ask(info,"delete");
			var buttons = findByClass(info.container,"tc-confirm-buttons").children;
			expect(buttons.length).toBe(2);
			expect(buttons[0].className).toContain("tc-confirm-decline");
			expect(buttons[0].textContent).toBe("Keep");
			expect(buttons[1].className).toContain("tc-confirm-accept");
			expect(buttons[1].textContent).toBe("Delete");
		});

		it("should fall back to yes and no for other kinds of question", function() {
			var info = setupDisplay();
			ask(info,"action");
			var buttons = findByClass(info.container,"tc-confirm-buttons").children;
			expect(buttons[0].textContent).toBe("No");
			expect(buttons[1].textContent).toBe("Yes");
		});

		it("should make the rest of the page inert while the question is waiting", function() {
			var info = setupDisplay();
			ask(info,"delete");
			var page = findByClass(info.container,"page"),
				dialog = findByClass(info.container,"tc-confirm");
			expect(page.getAttribute("inert")).toBe("");
			expect(findByClass(info.container,"tc-confirm-backdrop").getAttribute("inert")).toBe("");
			expect(dialog.getAttribute("inert")).toBe(undefined);
			// Answering restores the page
			var title = info.wiki.getTiddlersWithTag(QUESTION_TAG)[0],
				changes = {};
			$tw.utils.answerConfirmation(info.wiki,title,false);
			changes[title] = {deleted: true};
			info.refresh(changes);
			expect(findByClass(info.container,"tc-confirm")).toBe(undefined);
			expect(page.getAttribute("inert")).toBe(undefined);
		});

		it("should leave alone the nodes that were already inert", function() {
			var info = setupDisplay(),
				page = findByClass(info.container,"page");
			page.setAttribute("inert","");
			ask(info,"delete");
			var title = info.wiki.getTiddlersWithTag(QUESTION_TAG)[0],
				changes = {};
			$tw.utils.answerConfirmation(info.wiki,title,false);
			changes[title] = {deleted: true};
			info.refresh(changes);
			expect(page.getAttribute("inert")).toBe("");
		});

		it("should answer through the buttons", function() {
			var info = setupDisplay(),
				dispatched = [];
			info.widgetNode.addEventListener("tm-test",function(event) {
				dispatched.push(event);
				return false;
			});
			ask(info,"delete");
			var title = info.wiki.getTiddlersWithTag(QUESTION_TAG)[0],
				button = findNode(info.widgetNode,function(widget) {
					return widget.parseTreeNode && widget.parseTreeNode.type === "button" && widget["class"] === "tc-confirm-accept";
				});
			button.invokeActionString(button.actions,button,null,{});
			expect(info.wiki.tiddlerExists(title)).toBe(false);
			expect(dispatched.length).toBe(1);
		});

	});

});
