function SprintData(workitems, repository, viewByTasks) {

    this.RawWits = workitems;
    this.Wits = [];

    this.Repository = repository;
    this.StartDate = new Date(repository.IterationStartDate.toISOString()).getGMT();
    this.EndDate = new Date(repository.IterationFinishDate.toISOString()).getGMT();

    this.Dates;


    this.ViewByTasks = viewByTasks;
    this.nameById = [];

    this.IsSameWorkItems = function (newWorkItems){
        if (!newWorkItems){
            return false;
        }
        if (newWorkItems.length != this.RawWits.length){
            return false;
        }
        var res = true;
        this.RawWits.forEach(function (item, index) {
            var item2 = newWorkItems[index];
            if (!item2 || 
                item.id != item2.id ||
                item.rev != item2.rev)
                {
                    res = false;
                }
        });

        return res;
    }

    this.Init = function () {
        var items = [];
        this.RawWits.forEach(function (item, index) {
            items.push(new Workitem(item, repository.WorkItemTypes, repository.WorkItemPBITypes));
        });

        this.Wits = SortWits(items);

        this.Dates = getDates(this.StartDate, this.EndDate);
    }

    function SortWits(items) {

        return items.sort(function (a, b) {

            if (a.isTaskWit && b.isTaskWit) {

                if (!a.StartDate && !b.StartDate) {
                    var parentIda = a.GetParentId();
                    var parentIdb = b.GetParentId();
                    var pa = null, pb = null;

                    if (parentIda == parentIdb) {
                        pa = a.BacklogPriority || 0;
                        pb = b.BacklogPriority || 0;
                    } else {
                        items.forEach(function (item, index) {
                            if (item.Id == parentIda) pa = item.BacklogPriority || 0;
                            if (item.Id == parentIdb) pb = item.BacklogPriority || 0;
                        });
                    }

                    if ((pa || 0) != 0 && (pb || 0) != 0) {
                        return pa - pb;
                    }
                } else if (!a.StartDate && b.StartDate) {
                    return 1;
                } else if (a.StartDate && !b.StartDate) {
                    return -1;
                }


            }

            return a.Id - b.Id;
        });
    }

    this.GetWorkitemById = function (id) {
        return jQuery.grep(this.Wits, function (element) { return element.Id == id; })[0];
    }

    this.GetAssignToNameById = function(id){
        return this.nameById[id].Name;
    }

    this.Init();

    this.GetData = function () {

        var result = new Array();
        var names = {};
        var areaPaths = {};
        var areaPathsId = 1;

        for (var i = 0; i < this.Wits.length; i++) {
            var workItem = this.Wits[i];
            var personRow;

            if (!names[workItem.AssignedTo.displayName]) {
                names[workItem.AssignedTo.displayName] = { id: result.length, days: [] };
                var newName = {
                    Name: workItem.AssignedTo.displayName,
                    Capacity: this.Repository.GetCapacity(workItem.AssignedTo.displayName),
                    TotalCapacity: 0,
                    TatalTasks: 0,
                    assignedTo: workItem.AssignedTo.displayName,
                    avatar: this.Repository.GetMemberImage(workItem.AssignedTo.displayName),
                    assignedToId: result.length,
                    hasItems: false,
                };
                for (var colIndex = 0; colIndex < this.Dates.length; colIndex++) {
                    var currentDate = this.Dates[colIndex];
                    var isDayOff = this.Repository.IsDayOff(workItem.AssignedTo.displayName, currentDate.yyyymmdd(), currentDate.getDay());
                    newName[currentDate.yyyymmdd()] = [];
                    newName[currentDate.yyyymmdd()].isDayOff = isDayOff;

                    if (currentDate >= _today && !isDayOff) {
                        newName.TotalCapacity = newName.TotalCapacity + newName.Capacity;
                    }
                }

                result.push(newName);
                this.nameById[names[workItem.AssignedTo.displayName].id] = { Name: workItem.AssignedTo.displayName };
            }

            personRow = result[names[workItem.AssignedTo.displayName].id];

            var remainingWork = 0;

            if (workItem.isTaskWit) {

                remainingWork = workItem.RemainingWork;
                personRow.TatalTasks = personRow.TatalTasks + remainingWork;
            }

            if ((!this.ViewByTasks && workItem.isPBIWit) || (this.ViewByTasks && workItem.isTaskWit)) {
                if (!areaPaths[workItem.AreaPath]) {
                    areaPaths[workItem.AreaPath] = { id: areaPathsId };
                    areaPathsId = areaPathsId + 1;
                }

                personRow.hasItems = true;

                var isWitTask;


                if (this.ViewByTasks && workItem.isTaskWit) {

                    isWitTask = true;
                    var capacity = personRow.Capacity;
                    var witChanged = false;

                    if (!workItem.StartDate) {
                        witChanged = true;
                        this.Dates.forEach(function (item, index) {
                            var tasksPerDay = names[workItem.AssignedTo.displayName].days[item.yyyymmdd()] || 0;
                            if ((tasksPerDay < capacity || capacity == 0) && !workItem.StartDate && !repository.IsDayOff(workItem.AssignedTo.displayName, item.yyyymmdd(), item.getDay()) && (item >= _today)) {
                                workItem.StartDate = item;
                            }
                        });

                        if (!workItem.StartDate) {
                            workItem.StartDate = sprint.EndDate;
                        }
                    }

                    if (!workItem.FinishDate) {
                        witChanged = true;
                        var remainingWorkLeft = remainingWork;
                        var dates = getDates(workItem.StartDate, sprint.EndDate);
                        dates.forEach(function (item, index) {
                            var tasksPerDay = names[workItem.AssignedTo.displayName].days[item.yyyymmdd()] || 0;

                            if ((tasksPerDay < capacity || capacity == 0) && !repository.IsDayOff(workItem.AssignedTo.displayName, item.yyyymmdd(), item.getDay()) && !workItem.FinishDate) {

                                var todayPart = remainingWorkLeft;
                                if (tasksPerDay + todayPart > capacity && capacity > 0) {
                                    todayPart = capacity - tasksPerDay;
                                }
                                remainingWorkLeft = remainingWorkLeft - todayPart;

                                if (remainingWorkLeft == 0) {
                                    workItem.FinishDate = item;
                                }
                            }
                        });


                        if (!workItem.FinishDate) {
                            workItem.FinishDate = sprint.EndDate;
                        }

                    }

                    if (witChanged) {
                        pushWitToSave(workItem.Id);
                    }

                }

                if (!this.ViewByTasks && workItem.isPBIWit) {
                    isWitTask = false;
                    workItem.StartDate = sprint.EndDate;
                    workItem.FinishDate = sprint.StartDate;

                    if (workItem.Relations) {
                        workItem.Relations.forEach(function (item, index) {
                            if (item.rel == "System.LinkTypes.Hierarchy-Forward") {
                                var childId = item.url.substring(item.url.lastIndexOf("/") + 1);
                                var childWit = sprint.GetWorkitemById(childId);
                                if (childWit) {

                                    if (childWit.Blocked == "Yes") {
                                        workItem.Blocked = childWit.Blocked;
                                    }

                                    var ds = childWit.StartDate;
                                    var de = childWit.FinishDate;

                                    if (workItem.StartDate > ds) {
                                        workItem.StartDate = ds;
                                    }

                                    if (workItem.FinishDate < de) {
                                        workItem.FinishDate = de;
                                    }
                                }
                            }
                        });
                    }

                }

                if (workItem.StartDate < sprint.StartDate) workItem.StartDate = sprint.StartDate;
                if (workItem.StartDate > sprint.EndDate) workItem.StartDate = sprint.EndDate;
                if (workItem.FinishDate > sprint.EndDate) workItem.FinishDate = sprint.EndDate;
                if (workItem.FinishDate < workItem.StartDate) workItem.FinishDate = workItem.StartDate;

                var dates = getDates(workItem.StartDate, workItem.FinishDate);

                var selectedRow = -1;
                var found = false;
                while (!found) {
                    found = true;
                    selectedRow = selectedRow + 1;
                    for (var colIndex = 0; colIndex < dates.length; colIndex++) {
                        var date = dates[colIndex].yyyymmdd();
                        if (personRow[date].length > selectedRow) {
                            if (personRow[date][selectedRow].Type != 0) {
                                found = false;
                            }
                        }
                    }
                }

                for (var colIndex = 0; colIndex < dates.length; colIndex++) {
                    var date = dates[colIndex].yyyymmdd();
                    personDateCell = personRow[date];
                
                    while (selectedRow >= personDateCell.length) personDateCell.push({ Type: 0 });

                    if (!this.Repository.IsDayOff(workItem.AssignedTo.displayName, dates[colIndex].yyyymmdd(), dates[colIndex].getDay())) {
                        var todayTasks = (names[workItem.AssignedTo.displayName].days[date] || 0);
                        var todayPart = remainingWork;
                        if (todayTasks + remainingWork > capacity) {
                            todayPart = capacity - todayTasks;
                        }
                        remainingWork = remainingWork - todayPart;
                        names[workItem.AssignedTo.displayName].days[date] = todayTasks + todayPart;
                    }

                    if (colIndex == 0) {
                        personDateCell.MaxDataRow = personDateCell.length;
                    }

                    personDateCell[selectedRow] = {
                        Type: 1,
                        part: colIndex,
                        total: dates.length,
                        workItem: workItem,
                        id: i,
                        endDate: dates[dates.length - 1],
                        areaPath: areaPaths[workItem.AreaPath],
                        isWitTask: isWitTask
                    };
                }
            }
        }

        return result.sort(function (a, b) { return a.assignedTo.localeCompare(b.assignedTo) });
    }
}