/*\
title: $:/core/modules/utils/confirm.js
type: application/javascript
module-type: utils

Asks the user to confirm an action through a question stored in the wiki.

\*/

"use strict";

var QUESTION_TITLE_PREFIX = "$:/temp/confirm/",
	QUESTION_TAG = "$:/tags/Confirmation",
	ALERT_TITLE = "$:/temp/alerts/confirm",
	ALERT_TAG = "$:/tags/Alert",
	IGNORED_FIELDS_TITLE = "$:/config/ConfirmIgnoredFields";

// Hashmap by question title of the questions waiting for an answer
var questions = Object.create(null),
	questionCount = 0,
	// The question that the user has just confirmed
	confirmedQuestion = null;

/*
Display an alert about an answer that cannot be applied
*/
function displayAlert(wiki,stringName) {
	wiki.addTiddler(new $tw.Tiddler({
		title: ALERT_TITLE,
		tags: [ALERT_TAG],
		text: $tw.language.getString(stringName),
		component: "confirm",
		modified: new Date()
	}));
}

/*
Ask the user to confirm an action. Returns true if the user has confirmed the action. Otherwise the question is stored in a temporary tiddler for the user interface to display and false is returned: the caller should then abandon the action, which is repeated from the start if the user confirms
message: text of the question
options.type: kind of confirmation ("delete", "cancel", "overwrite", "edit-shadow" or "action")
options.title: title of the tiddler to name in the question
options.tiddlers: array of titles of the tiddlers that the action concerns
options.widget: widget asking the question
options.event: widget message to dispatch on the widget to repeat the action
options.triggeringWidget: for action widgets, the widget that triggered the action; the action is then repeated by calling the invokeAction() method of the widget
*/
exports.confirm = function(message,options) {
	options = options || {};
	var widget = options.widget,
		wiki = (widget && widget.wiki) || $tw.wiki,
		isAction = $tw.utils.hop(options,"triggeringWidget");
	// Check whether the user has just confirmed this question
	if(confirmedQuestion && confirmedQuestion.widget === widget && confirmedQuestion.type === options.type && confirmedQuestion.title === options.title && confirmedQuestion.message === message) {
		confirmedQuestion = null;
		return true;
	}
	// Withdraw any earlier questions
	$tw.utils.each(Object.keys(questions),function(title) {
		if(questions[title].wiki === wiki) {
			delete questions[title];
		}
	});
	$tw.utils.each(wiki.getTiddlersWithTag(QUESTION_TAG),function(title) {
		wiki.deleteTiddler(title);
	});
	// Take a snapshot of the tiddlers that the action concerns
	var subjects = Object.create(null);
	$tw.utils.each(options.tiddlers,function(title) {
		if(title) {
			subjects[title] = wiki.getTiddler(title);
		}
	});
	// Remember how to repeat the action
	var questionTitle = QUESTION_TITLE_PREFIX + (++questionCount);
	questions[questionTitle] = {
		wiki: wiki,
		type: options.type,
		title: options.title,
		message: message,
		widget: widget,
		event: options.event,
		isAction: isAction,
		triggeringWidget: options.triggeringWidget,
		subjects: subjects,
		tiddler: new $tw.Tiddler({
			title: questionTitle,
			tags: [QUESTION_TAG],
			text: message,
			"confirm-type": options.type,
			"confirm-title": options.title
		})
	};
	// Store the question for the user interface to display
	wiki.addTiddler(questions[questionTitle].tiddler);
	return false;
};

/*
Answer a question asked through $tw.utils.confirm(). Returns true if the action was repeated
wiki: wiki containing the question
title: title of the question tiddler
confirmed: true if the user confirms the action
*/
exports.answerConfirmation = function(wiki,title,confirmed) {
	var question = questions[title],
		ignoredFields = $tw.utils.parseStringArray(wiki.getTiddlerText(IGNORED_FIELDS_TITLE,"")) || [],
		tiddler = wiki.getTiddler(title),
		// The question must still read as it was asked
		isWaiting = !!question && question.wiki === wiki && !!tiddler && tiddler.isEqual(question.tiddler,ignoredFields);
	// Withdraw the question
	if(question && question.wiki === wiki) {
		delete questions[title];
	}
	wiki.deleteTiddler(title);
	if(!confirmed) {
		return false;
	}
	// Refuse to answer a question that is no longer waiting
	if(!isWaiting || !question.widget) {
		displayAlert(wiki,"ConfirmationWithdrawn");
		return false;
	}
	// Refuse if the tiddlers have changed since the question was asked
	var isChanged = false;
	$tw.utils.each(question.subjects,function(tiddler,subjectTitle) {
		var currentTiddler = wiki.getTiddler(subjectTitle);
		if(tiddler ? !(currentTiddler && currentTiddler.isEqual(tiddler,ignoredFields)) : !!currentTiddler) {
			isChanged = true;
		}
	});
	if(isChanged) {
		displayAlert(wiki,"ConfirmationChanged");
		return false;
	}
	// Repeat the action, confirming the question when it is asked again
	confirmedQuestion = question;
	try {
		if(question.isAction) {
			question.widget.invokeAction(question.triggeringWidget,question.event);
		} else {
			question.widget.dispatchEvent(question.event);
		}
	} finally {
		confirmedQuestion = null;
	}
	return true;
};
