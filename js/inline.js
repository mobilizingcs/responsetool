$(function(){

    //initiate the client
    var client = "responsetool"
    var oh = Ohmage("/app", client)

    //debugging
    window.oh = oh;

    //global data table
    var table;

    //attach global callbacks
    oh.callback("done", function(x, status, req){
        //for debugging only
        //console.log(x);
    })

    //global error handler. In ohmage 200 means unauthenticated
    oh.callback("error", function(msg, code, req){
        (code == 200) ? window.location.replace("../web/#login") : message("<strong>Error! </strong>" + msg);
    });

    //prevent timeout
    oh.keepalive();

    //get data
    var urn = window.location.hash.replace(/^[#]/, "")
    var tbody = $("#responsetablebody")

    //redirect to manager of no campaign is specified
    if(!urn.match(/^urn/)){
        location.replace("../campaign_mgmt")
    } else {
        $("#switchviewlink").removeClass("disabled").attr("href", "media.html#" + urn)
        oh.campaign.readall({campaign_urn_list:urn}).done(function(data){
            console.log(data)
            $("#pagetitle small").text(data[urn].name)
        })
    }

    //populate table
    oh.user.whoami().done(function(username){
        oh.response.read(urn).done(function(data){
            $.each(data, function(i, value){

                //to filter responses from current user:
                //if(username != value.user) return;

                var tr = $("<tr>").appendTo(tbody).data("surveydata", value);
                var td = $("<td>").appendTo(tr).click(function(e){
                    e.stopPropagation();
                });
                var checkbox = $('<input class="rowcheckbox" type="checkbox">').appendTo(td).click(function(e){
                    $("#checkboxheader").prop("indeterminate", true);
                });

                $("<td>").text(value.timestamp).appendTo(tr);
                $("<td>").text(value.user).appendTo(tr);
                $("<td>").text(value.survey_title).appendTo(tr);

                /* share button */
                if(value.privacy_state == "shared") {
                    $("<td>").appendTo(tr).append('<span class="label label-success">shared</span>');
                } else {
                    $("<td>").appendTo(tr).append('<span class="label label-default">private</span>');
                }
            });
            initTable();
        });
    });

    function getPromptValue(value){
        if(["SKIPPED", "NOT_DISPLAYED"].indexOf(value["prompt_response"]) > -1)
            return value["prompt_response"];
        switch (value["prompt_type"]) {
            case "text":
            case "number":
            case "timestamp":
                return value["prompt_response"];
            case "single_choice":
            case "single_choice_custom":
                return getSingleChoiceValue(value);
            case "multi_choice":
            case "multi_choice_custom":
                return getMultiChoiceValue(value);  
            case "video":
            case "audio":
            case "document":
                return $("<a>").text(value["prompt_type"]).attr("target", "_blank").attr("href", "/app/media/read?client=" + client + "&id=" + value["prompt_response"])
            case "photo":
                return $("<a>").text("photo").attr("href", "/app/image/read?client=" + client + "&id=" + value["prompt_response"])                
             default:
                console.log("Unsupported prompt: " + value["prompt_type"])
                console.log(value)
        }
    }

    function getSingleChoiceValue(value){
        var response = value["prompt_response"];
        var glos = value["prompt_choice_glossary"];
        return glos && glos[response] ? glos[response].label : response;
    }

    function getMultiChoiceValue(value){
        var responses = value["prompt_response"];
        var glos = value["prompt_choice_glossary"];
        var output = [];
        $.each(responses, function(i, response){
            output.push(glos && glos[response] ? glos[response].label : response)
        })
        return output;
    }    

    //data tables widget
    function initTable(){
        table = $('#responsetable').DataTable( {
            "dom" : '<"pull-right"l><"pull-left"f>tip',
            "order": [[ 1, "desc" ]],
            "lengthMenu": [[25, 50, 100, -1], [25, 50, 100, "All"]],
            "aoColumnDefs": [
               { 'bSortable': false, 'aTargets': [ 0 ] }
            ]
        });

        // Add event listener for opening and closing details
        $('#responsetable').on('click', 'tbody tr', function () {
            var tr = $(this)
            var row = table.row(tr);
            if(tr.attr("role") != "row") return;
     
            if ( row.child.isShown() ) {
                // This row is already open - close it
                row.child.hide();
                tr.removeClass('shown');
            }
            else {
                // Open this row
                row.child( makerow(row.data(), tr.data("surveydata"))).show();
                tr.addClass('shown');
            }
        });

        $("#checkboxheader").click(function(e){
            var checked = $(this).prop('checked');
            $(".rowcheckbox").prop('checked', checked);
        })

        table.on( 'page', resettable);
        table.on( 'length', resettable);
        table.on( 'order', resettable);
        table.on( 'search', resettable);

        $("#expand_all").click(expand_all)
        $("#collapse_all").click(collapse_all)
    }

    function expand_all(){
        $("tbody tr[role='row']").each(function(i){
            var tr = $(this)
            var row = table.row(tr);
            if(!row.child.isShown()){
                tr.trigger("click")
            }
        })        
    }

    function collapse_all(){
        $("tbody tr[role='row']").each(function(i){
            var tr = $(this)
            var row = table.row(tr);
            if(row.child.isShown()){
                tr.trigger("click")
            }
        })        
    }

    function resettable(){
        collapse_all()
        $(".rowcheckbox, #checkboxheader").prop('checked', false);
        $("#checkboxheader").prop("indeterminate", false);
    }

    function makerow(rowdata, survey){
        var row = $('<div/>').addClass('row').addClass("response-row");
        $.each(survey.responses, function(key, value){
            
            // do not list NOT_DISPLAYED answers in the table
            if(value["prompt_response"] == "NOT_DISPLAYED") return;
            var el = $('<div />').addClass("col-sm-6").addClass("col-lg-4").appendTo(row);
            el.append($("<h5/>").text(value["prompt_text"]));
            
            if(value["prompt_type"] === "photo" && ["SKIPPED", "NOT_DISPLAYED"].indexOf(value["prompt_response"]) < 0){
                el.append($("<img />").attr("src", "/app/image/read?client=" + client + "&id=" + value["prompt_response"]))                 
            } else {
                el.append(getPromptValue(value));
            }          
        });
        return row;
    }

    function message(msg, type){
        // type must be one of success, info, warning, danger
        type = type || "danger"
        $("#errordiv").empty().append('<div class="alert alert-' + type + '"><a href="#" class="close" data-dismiss="alert">&times;</a>' + msg + '</div>');
        $('html, body').animate({
           scrollTop: 100
        }, 200);
    }
});