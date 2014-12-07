'use strict';

angular.module('pgweb', ['ui.router.state', 'ui.router', 'ui.ace'])
.config([
	"$stateProvider", "$urlRouterProvider",
	function($stateProvider, $urlRouterProvider) {

		$stateProvider.state('root', {
			url: '',
			abstract: true,
			views: {
				"sidebar@": {
					templateUrl: '/static/tpl/sidebar-ctrl.html',
					controller: 'SidebarCtrl'
				}
			}
		}).state('root.home', {
			url: '/',
			views: {
				"content@": {
					templateUrl: '/static/tpl/home-ctrl.html',
					controller: 'HomeCtrl'
				}
			}
		}).state('root.query', {
			url: '/table/:table/query',
			views: {
				"content@": {
					templateUrl: '/static/tpl/query-ctrl.html',
					controller: 'QueryCtrl'
				}
			}
		}).state('root.data', {
			url: '/table/:table/data',
			views: {
				"content@": {
					templateUrl: '/static/tpl/data-ctrl.html',
					controller: 'DataCtrl'
				}
			}
		}).state('root.structure', {
			url: '/table/:table/structure',
			views: {
				"content@": {
					templateUrl: '/static/tpl/structure-ctrl.html',
					controller: 'StructureCtrl'
				}
			}
		}).state('root.history', {
			url: '/history',
			views: {
				"content@": {
					templateUrl: '/static/tpl/history-ctrl.html',
					controller: 'HistoryCtrl',
					resolve: {"historyData": [
						"apiSvc",
						function(apiSvc) {
							return apiSvc.getHistory();
						}
					]}
				}
			}
		});

		$urlRouterProvider.otherwise('/');
	}
])


.service("apiSvc", [
	"$http",
	function($http){
		this.getHistory = function(){
			return $http.get("/history").then(function(resp){
				return resp.data;
			});
		}

		this.getTables = function(){
			return $http.get('/tables').then(function(resp) {
				return resp.data;
			})
		}

		this.getTableInfo = function(table){
			return $http.get('/tables/' + table + '/info').then(function(resp) {
				return resp.data;
			});
		}

		this.executeQuery = function(query){
			return $http.post('/query', query).then(function(resp){
				return resp.data;
			});
		}

	}
])

.service("pageState", [
		"$stateParams", "$state",
		function($stateParams, $state){

			this.getCurrentTable = function(){
				return $stateParams.table;
			}

			this.changeTable = function(table, state){
				state = state || 'root.data';
				this.currentTable = table;
				if (!table) return;

				$state.go(state, {table: table});
			}

			this.goToState = function(state){
				this.changeTable(this.currentTable || this.getCurrentTable(), state);
			}

		}
])

.controller('SidebarCtrl', [
	"$scope", "apiSvc", "pageState",
	function($scope, apiSvc, pageState) {
		$scope.tables = [];
		$scope.tableinfo = {};

		apiSvc.getTables().then(function(tables){
			$scope.tables = tables;
		});

		$scope.selectTable = function(table) {
			pageState.changeTable(table);

			apiSvc.getTableInfo(table).then(function(tableinfo){
				$scope.tableifo = tableinfo;
			});
		};
	}
])


.controller('HomeCtrl', [
	"$scope", "$http", "pageState",
	function($scope, $http, pageState) {
	}
])


.controller('DataCtrl', [
	"$scope", "apiSvc", "pageState",
	function($scope, apiSvc, pageState) {
		$scope.results = {columns: [], rows: []};

		apiSvc.executeQuery({
			query: 'SELECT * FROM "' + pageState.getCurrentTable() + '" LIMIT 100'
		}).then(function(data){
			$scope.results = data;
		}, function(resp){
			alert("Error: " + resp.data.error);
		});
	}
])


.controller('StructureCtrl', [
	"$scope", "$http", "$stateParams",
	function($scope, $http, $stateParams) {
		$scope.structure = {columns: [], rows: []};
		$http.get('/tables/' + $stateParams.table).success(function(data, status) {
			$scope.structure = data;
		})

		$scope.indexes = {columns: [], rows: []};
		$http.get('/tables/' + $stateParams.table + '/indexes').success(function(data, status) {
			$scope.indexes = data;
		})
	}
])


.controller('QueryCtrl', [
	"$scope", "apiSvc", "pageState",
	function($scope, apiSvc, pageState) {
		$scope.query = 'SELECT * FROM "' + pageState.getCurrentTable() + '" LIMIT 10;';
		$scope.results = {columns: [], rows: []};
		$scope.loading = false;

		$scope.aceLoaded = function(_editor) {
			console.log("ACE LOADDDEEED");
			_editor.getSession().setMode("ace/mode/pgsql");
			_editor.getSession().setTabSize(2);
			_editor.getSession().setUseSoftTabs(true);
		};

		$scope.doQuery = function(query, explain) {
			$scope.loading = true;
			apiSvc.executeQuery({query: query, explain: !!explain}).then(function(){
				$scope.results = data;
				$scope.loading = false;
			}, function(resp){
				// Use some "angular-toastr" goodness instead
				alert("Error: " + resp.status + "\n" + resp.data.error);
			}).finally(function(){
				$scope.loading = false;
			});
		};

		$scope.downloadCsv = function(query) {
			query = query.replace(/\n/g, " ");

			var url = "http://" + window.location.host + "/query?format=csv&query=" + query;
			var win = window.open(url, '_blank');
			win.focus();
		}
	}
])


.controller('HistoryCtrl', [
	"$scope", "$http", "historyData",
	function($scope, $http, results) {
		// Fetch history from somewhere ?
		console.log("History endpoint: ", results);

		var rows = [], i;
		for(i in results) {
			rows.unshift([parseInt(i) + 1, results[i]]);
		}

		$scope.results = {
			columns: ["id", "query"],
			rows: rows
		};
	}
])


.directive('pgContentNavigation', [
	"$state", "pageState",
	function($state, pageState) {
		return {
			templateUrl: "/static/tpl/content-navigation-directive.html",
			link: function($scope, $element, $attrs) {
				$scope.active = $state.current.name;
				$scope.go = function(where) {
					pageState.goToState(where);
				};
			}
		}
	}
])

.directive('pgTableView', [
	function() {
		return {
			scope: {
				results: "=pgTableView",
			},
			templateUrl: "/static/tpl/table-view-directive.html",
			link: function($scope, $element, $attrs) {
				$scope.showResults = function() {
					return !$scope.results.error && $scope.results.rows && $scope.results.rows.length;
				}
				$scope.isValid = function(input) {
					return !(input == null || input == undefined);
				};
			}
		}
	}
])
;
