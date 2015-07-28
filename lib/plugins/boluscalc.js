'use strict';
var   _ = require('lodash')
  , cob = require('./cob')()
  , iob = require('./iob')();
  
function init() {
  var last_sbx;
  var translate;
  
  function boluscalc() {
    return boluscalc;
  }

  boluscalc.label = 'Bolus Wizard';
  boluscalc.pluginType = 'drawer';
  
  boluscalc.updateVisualisation = function updateVisualisation (sbx) {
    last_sbx = sbx;
    // Set units info
    if (sbx.units == 'mmol') $('#bc_units').text('mmol/L');
    else $('#bc_units').text('mg/dL');

    boluscalc.calculateInsulin();
  }

  var quickpicks = [];
  var foods = [];

  var icon_remove = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAACrElEQVQ4T42Ty2sTQRzHv5tmk2yyjRNtpfZhL8V6s2KoUNC2XqwgaCsVQcGiFqpHi0c9iRdR/ANE9KR40FIQX4cueKoPaKFoLdSYNtE0abKT1+5s9iW7aUMiHtzTzO7v85md+c6PA4DrHbsPCKIgOWO1pA7dT6YXnXH949SE/F63pqwZtRrO+SCKgjQ5NUV+azpmHj2krMwaJC4c8Erj+/eRyloMMwWFKgbn1nC3ervlK1evkXBLGBZT8SOewotnTylTNLdgeg/pDgZDC2cPHSR8bB22DVC9hFe0SG/H0xFXcHlykjRHRDBWgJcZSCY38Xx2lhqMnRYE34Px/sN9vlQWeoHBAx2yXsRruVAVuFsIBaSJ8+eJGPaBqQV4NROJjTzez89jLBoFn6FgybQL54wS3uTyVDFQ3cL2IYpBv3RhdJSIIQ80tQyv7gEqJvS8AmUlBs7UXPhtjtZgh3UFNYngk86NHCfNAg9dMwHVBPu+CpsVkTXKeJeVG+AGgTOZ3tt6MSKKjy+NjEBjFrR4ElZmA4pdxstMFsyyJu6tZZ7Ux9vwB6EAL50ZGiRECEPPUOixVTRxHlicgSVWxEdZpuZWfNuS2hk48NjwMIkIYZglBnV5Cbqtws/5IaAJmsfCglrEl2y2QeKmEBJ80tixKmxrFpSVr0gV0viQoxho2YUuPohmeFD22PiklLC4ma5JuBvdrfLJI0dJd0s7bM0ES8aR/BXDXGaTskqlL+D3Lwy0tZEePoAd4EA5YF4tYymdonfjmQh3s6dTPjU4SHYGwjAKecSXFyGlM1TdytntE56T+ts7SC/vhw3gm6njc2Kd3vm5Ub1IwQAvnYhGiZpYw1wiWYPrIw7wnBTt7CLOOwdmut14kQQvqt24tfK/utGR6LaF+iRqMf4N/O/8D28HiiCRYqzAAAAAAElFTkSuQmCC";

  boluscalc.initGUI = function initGUI()  {
    if (isTouch())
      $('.insulincalculationpart').change(boluscalc.calculateInsulin); // Make it faster on mobile devices
    else {
      $('.insulincalculationpart').on('input',boluscalc.calculateInsulin);
      $('input:checkbox.insulincalculationpart').change(boluscalc.calculateInsulin);
    }
    $('#bc_bgfrommeter').change(boluscalc.calculateInsulin);
    $('#bc_addfromdatabase').click(addFoodFromDatabase);

    $('#bc_eventTime input:radio').change(function (event){
      if ($('#bc_othertime').is(':checked')) {
        $('#bc_eventTimeValue').focus();
      } else {
        boluscalc.calculateInsulin();
        Nightscout.utils.setYAxisOffset(50); //50% of extend
        Nightscout.utils.updateBrushToTime(Nightscout.utils.mergeInputTime($('#bc_eventTimeValue').val(), $('#bc_eventDateValue').val()).toDate());
      }
      event.preventDefault();
    });

    $('.bc_eventtimeinput').focus(function (event) {
      $('#bc_othertime').prop('checked', true);
      var moment = Nightscout.utils.mergeInputTime($('#bc_eventTimeValue').val(), $('#bc_eventDateValue').val());
      $(this).attr('oldminutes', moment.minutes());
      $(this).attr('oldhours', moment.hours());
      event.preventDefault();
    });

    $('.bc_eventtimeinput').change(function (event) {
      $('#bc_othertime').prop('checked', true);
      event.preventDefault();
      boluscalc.calculateInsulin();
      Nightscout.utils.setYAxisOffset(50); //50% of extend
      var moment = Nightscout.utils.mergeInputTime($('#bc_eventTimeValue').val(), $('#bc_eventDateValue').val());
      if ($(this).attr('oldminutes') === ' 59' && moment.minutes() === 0) {
        moment.add(1, 'hours');
      }
      if ($(this).attr('oldminutes') === '0' && moment.minutes() === 59) {
        moment.add(-1, 'hours');
      }
      $('#bc_eventTimeValue').val(moment.format('HH:mm'));
      $('#bc_eventDateValue').val(moment.format('YYYY-MM-D'));
      $(this).attr('oldminutes', moment.minutes());
      $(this).attr('oldhours', moment.hours());
      Nightscout.utils.updateBrushToTime(moment.toDate());
    });


    $('#boluscalcDrawerToggle').click(function(event) {
      toggleDrawer('#boluscalcDrawer', initBoluscalcDrawer, destroyBoluscalcDrawer);
      event.preventDefault();
    });

    $('#boluscalcDrawer').find('button').click(boluscalcSubmit);

  // Load quickpicks
    $.ajax('/api/v1/food/quickpicks.json', {
      success: function (records) {
        quickpicks = records;
        $('#bc_quickpick').empty().append(new Option('(none)',-1));
        for (var i=0; i<records.length; i++) {
          var r = records[i];
          $('#bc_quickpick').append(new Option(r.name+' ('+r.carbs+' g)',i));
        };
        $('#bc_quickpick').change(quickpickChange);
      }
    });
  }

  function destroyBoluscalcDrawer() {
    Nightscout.utils.resetYAxisOffset();
    Nightscout.utils.updateBrushToNow();
  }

  function initBoluscalcDrawer()  {
    var bg = 0;
    $('#bc_bg').val(bg);
    
    foods = [];
    $('#bc_usebg').prop('checked','checked');
    $('#bc_usecarbs').prop('checked','checked');
    $('#bc_usecob').prop('checked','');
    $('#bc_useiob').prop('checked','checked');
    $('#bc_bgfromsensor').prop('checked','checked');
    $('#bc_carbs').val('');
    $('#bc_quickpick').val(2);
    $('#bc_preBolus').val(0);
    $('#bc_notes').val('');
    $('#bc_enteredBy').val($.localStorage.get('enteredBy') || '');
    $('#bc_nowtime').prop('checked', true);
    $('#bc_othercorrection').val(0); 
    boluscalc.calculateInsulin();
  }
  
  boluscalc.calculateInsulin = function calculateInsulin(event) {
    console.log('Using sbx for calculation:',last_sbx);
    if (!last_sbx) {
      console.log('No sandbox data yet. Exiting calculateInsulin()');
      return;
    }
    if (event) event.preventDefault();
    
    var units = browserSettings.units;
    var now = new Date();
    
    var record = {};
    var oldbg = false;
    var sensorbg = 0;
    
    // Clear results before check
    $('#bc_insulintotal').text('0.00');
    $('#bc_carbsneeded').text('0.00');
    $('#bc_inzulinbg').text('0.00');
    $('#bc_inzulincarbs').text('0.00');

    // Calculate event time from date & time
    record.eventTime = new Date();
    if ($('#bc_nowtime').is(':checked')) {
      $('#bc_eventTimeValue').val(moment().format('HH:mm'));
      $('#bc_eventDateValue').val(moment().format('YYYY-MM-D'));
      $('#bc_retro').css('display','none');
    } else {
      record.eventTime = new Date(Nightscout.utils.mergeInputTime($('#bc_eventTimeValue').val(), $('#bc_eventDateValue').val()));
      $('#bc_retro').css('display','');
    }
    var lastSGV = _.last(last_sbx.data.sgvs);
    if (lastSGV) {
      sensorbg = lastSGV.mgdl;
      if (sensorbg < 39) sensorbg = 0;
      else sensorbg = Nightscout.utils.scaleBg(sensorbg);
      if (record.eventTime.getTime() - lastSGV.mills > 10 * 60 * 1000) {
        oldbg = true; // Do not use if record is older than 10 min
        sensorbg = 0;
      }
    }
      
    //Load BG
    if ($('#bc_bgfromsensor').is(':checked')) {
      $('#bc_bg').val(sensorbg ? sensorbg : '');
    }

    // Load IOB
    record.iob = 0;
    if ($('#bc_useiob').is(':checked')) {
      record.iob = parseFloat(iob.calcTotal(last_sbx.data.treatments,last_sbx.data.profile,record.eventTime).iob);
      $('#bc_iob').text((record.iob > 0 ? '-' : '') + record.iob.toFixed(2));
    } else {
      $('#bc_iob').text('');
    }

    // Load COB
 //   var ic = Nightscout.currentProfile.ic(record.eventTime,units);
    var ic = last_sbx.data.profile.getCarbRatio(record.eventTime);
    if ($('#bc_usecob').is(':checked')) {
      record.cob = cob.cobTotal(last_sbx.data.treatments,last_sbx.data.profile,record.eventTime).cob || 0;
      record.insulincob = roundTo00(record.cob / ic);
      $('#bc_cob').text(record.cob.toFixed(2));
      $('#bc_cobu').text(record.insulincob.toFixed(2));
    } else {
      record.cob = 0;
      record.insulincob = 0;
      $('#bc_cob').text('');
      $('#bc_cobu').text('');
    }

    // BG
    if ($('#bc_usebg').is(':checked')) {
      record.bg = parseFloat($('#bc_bg').val().replace(',','.'));
      if (record.bg == 0 || (oldbg && $('#bc_bgfromsensor').is(':checked'))) {
        $('#bc_bg').css('background-color','red');
      } else $('#bc_bg').css('background-color','');
      var bgdiff = 0;
//      var targetBGLow = Nightscout.currentProfile.targetBGLow(record.eventTime,units);
      var targetBGLow = last_sbx.data.profile.getLowBGTarget(record.eventTime);
//      var targetBGHigh = Nightscout.currentProfile.targetBGHigh(record.eventTime,units);
      var targetBGHigh = last_sbx.data.profile.getHighBGTarget(record.eventTime);
//      var isf = Nightscout.currentProfile.isf(record.eventTime,units);
      var isf = last_sbx.data.profile.getSensitivity(record.eventTime);
      if (targetBGLow==0 || targetBGHigh==0 || isf==0) {
        $('#bc_inzulinbgtd').css('background-color','red');
        return null;
      } else $('#bc_inzulinbgtd').css('background-color','');
      if (record.bg <= targetBGLow) bgdiff = record.bg - targetBGLow;
      else if (record.bg >= targetBGHigh) bgdiff = record.bg - targetBGHigh;
      record.insulinbg = roundTo00(bgdiff / isf);
      $('#bc_inzulinbg').text(record.insulinbg.toFixed(2));
      $('#bc_inzulinbg').attr('title',
        'Target BG range: '+targetBGLow + ' - ' + targetBGHigh + 
        '\nISF: ' +  isf +
        '\nBG diff: ' +  bgdiff.toFixed(1)
        );
    } else {
      record.bg = 0;
      record.insulinbg = 0;
      $('#bc_inzulinbgtd').css('background-color','');
      $('#bc_bg').css('background-color','');
      $('#bc_inzulinbg').text('');
    }
    
    // Foods
    if (foods.length) {
      var carbs = 0, gisum = 0;
      var html = '<table  style="float:right;margin-right:20px;font-size:12px">';
      for (var fi=0; fi<foods.length; fi++) {
        var f = foods[fi];
        carbs += f.carbs * f.portions;
        gisum += f.carbs * f.portions * f.gi;
        html += '<tr>';
        html += '<td>';
        html += '<img style="cursor:pointer" title="Delete record" src="'+icon_remove+'" href="#" class="deleteFoodRecord" index="'+fi+'">';
        html += '</td>';
        html += '<td>'+ f.name + '</td>';
        html += '<td>'+ (f.portion*f.portions).toFixed(1) + ' ' + f.unit + '</td>';
        html += '<td>('+ (f.carbs*f.portions).toFixed(1) + ' g)</td>';
        html += '</tr>';
      }
      html += '</table>';
      $('#bc_food').html(html);
      $('.deleteFoodRecord').click(deleteFoodRecord);
      $('#bc_carbs').val(carbs.toFixed(0));
      $('#bc_carbs').attr('disabled',true);
      $('#bc_gi').css('display','none');
      $('#bc_gicalculated').css('display','');
      record.gi = (gisum/carbs).toFixed(2);
      $('#bc_gicalculated').text(record.gi);
      //$('#bc_gitd').attr('colspan','');
    } else {
      $('#bc_food').html('');
      $('#bc_carbs').attr('disabled',false);
      record.gi = $('#bc_gi').val();
      $('#bc_gi').css('display','');
      $('#bc_gicalculated').css('display','none');
      $('#bc_gicalculated').text('');
      //$('#bc_gitd').attr('colspan',3);
    }
    record.foods = _.cloneDeep(foods);
    
    // Carbs
    if ($('#bc_usecarbs').is(':checked')) {
      record.carbs = parseInt($('#bc_carbs').val().replace(',','.'));
      if ($('#bc_carbs').val()=='') {
        record.carbs = 0;
        $('#bc_carbs').css('background-color','');
      } else if (isNaN(record.carbs)) {
        $('#bc_carbs').css('background-color','red');
        return null;
      } else $('#bc_carbs').css('background-color','');
      if (ic==0) {
        $('#bc_inzulincarbstd').css('background-color','red');
        return null;
      } else $('#bc_inzulincarbstd').css('background-color','');
      record.insulincarbs = roundTo00(record.carbs / ic);
      $('#bc_inzulincarbs').text(record.insulincarbs.toFixed(2));
      $('#bc_inzulincarbs').attr('title','IC: ' +  ic);
    } else {
      record.carbs = 0;
      record.insulincarbs = 0;
      $('#bc_carbs').css('background-color','');
      $('#bc_inzulincarbs').text('');
      $('#bc_carbs').text('');
    }
    
    
    // Corrections
    record.othercorrection = parseFloat($('#bc_othercorrection').val().replace(',','.'));

    // Total & rounding
    var total = 0;
    if ($('#bc_useinsulin').is(':checked')) {
      total = record.insulinbg + record.insulincarbs + record.insulincob - record.iob + record.othercorrection;
    }
    record.insulin = floorTo005(total);
    record.roundingcorrection = record.insulin - total;
    
    $('#bc_rouding').text(record.roundingcorrection.toFixed(2));
    $('#bc_insulintotal').text(record.insulin);
    
    // Carbs needed if too much iob
    record.carbsneeded = 0;
    if (record.insulin<0) {
      record.carbsneeded = Math.round(-total * ic);
      $('#bc_carbsneeded').text(record.carbsneeded+' g');
      $('#bc_insulinover').text(record.insulin.toFixed(2));
      $('#bc_carbsneededtr').css('display','');
      $('#bc_insulinneededtr').css('display','none');
    } else {
      $('#bc_carbsneeded').text('');
      $('#bc_insulinover').text('');
      $('#bc_carbsneededtr').css('display','none');
      $('#bc_insulinneededtr').css('display','');
    }
    
    // Basal rate
//    $('#bc_basal').text(Nightscout.currentProfile.basal(record.eventTime).toFixed(3));
    $('#bc_basal').text(last_sbx.data.profile.getBasal(record.eventTime).toFixed(3));
    console.log('Insulin calculation result: ',record);
    return record;
  }

  function roundTo00(x) {
    return Math.round(100*x) / 100;
  }
  
  function floorTo005(x) {
    return (5 * Math.floor(100*x/5)) / 100;
  }
  
  function boluscalcSubmit(event) {
    var translate = Nightscout.language.translate;

    if (event) event.preventDefault();

    var data = {};
    data.boluscalc = boluscalc.calculateInsulin();
    if (!data.boluscalc) {
      alert('Calculation not completed!');
      return;
    }
    
    data.enteredBy = $('#bc_enteredBy').val();
    data.eventType = 'Bolus Wizard';
    if ($('#bc_bg').val()!=0) {
      data.glucose = $('#bc_bg').val();
      data.glucoseType = $('#bc_bgfrommeter').is(':checked') ? 'Finger' : (  $('#bc_bgfromsensor').is(':checked') ? 'Sensor' : 'Manual');
      data.units = browserSettings.units;
    }
    data.carbs = $('#bc_carbs').val();
    data.insulin = $('#bc_insulintotal').text();
    if (data.insulin<=0) delete data.insulin;
    data.preBolus = parseInt($('#bc_preBolus').val());
    data.notes = $('#bc_notes').val();

    var eventTimeDisplay = '';
    if ($('#bc_othertime').is(':checked')) {
      data.eventTime = Nightscout.utils.mergeInputTime($('#bc_eventTimeValue').val(), $('#bc_eventDateValue').val());
      eventTimeDisplay = data.eventTime.toLocaleString();
    }

    var dataJson = JSON.stringify(data, null, ' ');

    var ok = window.confirm(
        translate('Please verify that the data entered is correct')+': ' +
        '\n'+translate('Event Type')+': ' + data.eventType +
        (data.glucose ? '\n'+translate('Blood Glucose')+': ' + data.glucose : '')+
        (data.glucoseType ? '\n'+translate('Method')+': ' + data.glucoseType : '')+
        (data.carbs ? '\n'+translate('Carbs Given')+': ' + data.carbs : '' )+
        (data.insulin ? '\n'+translate('Insulin Given')+': ' + data.insulin : '')+
        (data.preBolus ? '\n'+translate('Pre Bolus')+': ' + data.preBolus : '')+
        (data.notes ? '\n'+translate('Notes')+': ' + data.notes : '' )+
        (data.enteredBy ? '\n'+translate('Entered By')+': ' + data.enteredBy : '' )+
        ($('#bc_othertime').is(':checked') ? '\n'+translate('Event Time')+': ' + eventTimeDisplay : '')
    );

    if (ok) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/v1/treatments/', true);
      xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
      xhr.setRequestHeader('api-secret', Nightscout.auth.hash());
      xhr.onload = function () {
        if (xhr.statusText!='OK') {
          alert(translate('Entering record failed')+'\n'+translate(xhr.statusText));
        }
      }
      xhr.send(dataJson);

      $.localStorage.set('enteredBy', data.enteredBy);

      quickpickHideFood();
      closeDrawer('#boluscalcDrawer',destroyBoluscalcDrawer);
    }
    return false;
  }

  // Food manipulation
  function deleteFoodRecord(event) {
    var index = $(this).attr('index');
    foods.splice(index,1);
    boluscalc.calculateInsulin();
    if (event) event.preventDefault();
    return false;
  }
  
  function quickpickChange(event) {
    var qpiselected = $('#bc_quickpick').val();
    
    if (qpiselected == -1) { // (none)
      $('#bc_carbs').val(0);
      foods = [];
    } else {
      var qp = quickpicks[qpiselected];
      foods = _.cloneDeep(qp.foods);
    }
    
    boluscalc.calculateInsulin();
    if (event) event.preventDefault();
  }
  
  function quickpickHideFood() {
    var qpiselected = $('#bc_quickpick').val();
    
    if (qpiselected == -1) { // (none)
      return;
    } else {
      var qp = quickpicks[qpiselected];
      if (qp.hideafteruse) {
        qp.hidden = true;

        var apisecrethash = localStorage.getItem('apisecrethash');
        var dataJson = JSON.stringify(qp, null, ' ');

        var xhr = new XMLHttpRequest();
        xhr.open('PUT', '/api/v1/food/', true);
        xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
        xhr.setRequestHeader('api-secret', apisecrethash);
        xhr.send(dataJson);
      }
    }
    
    boluscalc.calculateInsulin();
    if (event) event.preventDefault();
  }
  
  var categories = [];
  var foodlist = [];
  var databaseloaded = false;
  var filter = {
      category: ''
    , subcategory: ''
    , name: ''
  };
  
  function loadDatabase(callback) {
    categories = [];
    foodlist = [];
    $.ajax('/api/v1/food/regular.json', {
      success: function (records) {
        records.forEach(function (r) {
          foodlist.push(r);
          if (r.category && !categories[r.category]) categories[r.category] = {};
          if (r.category && r.subcategory) categories[r.category][r.subcategory] = true;
        });
        databaseloaded = true;
        console.log('Food database loaded');
        fillForm();
      }
    }).done(function() { if (callback) callback(); } );
  }

  function fillForm(event) {
    $('#bc_filter_category').empty().append(new Option('(none)',''));
    for (var s in categories) {
      $('#bc_filter_category').append(new Option(s,s));
    }
    filter.category = '';
    fillSubcategories();
    
    $('#bc_filter_category').change(fillSubcategories);
    $('#bc_filter_subcategory').change(doFilter);
    $('#bc_filter_name').on('input',doFilter);
  
    if (event) event.preventDefault();
    return false;
  }

  function fillSubcategories(event) {
    if (event) {
      event.preventDefault();
    }
    filter.category = $('#bc_filter_category').val();
    filter.subcategory = '';
    $('#bc_filter_subcategory').empty().append(new Option('(none)',''));
    if (filter.category != '') {
      for (var s in categories[filter.category]) {
        $('#bc_filter_subcategory').append(new Option(s,s));
      }
    }
    doFilter();
  }
  
  function doFilter(event) {
    if (event) {
      filter.category = $('#bc_filter_category').val();
      filter.subcategory = $('#bc_filter_subcategory').val();
      filter.name = $('#bc_filter_name').val();
    }
    $('#bc_data').empty();
    for (var i=0; i<foodlist.length; i++) {
      if (filter.category != '' && foodlist[i].category != filter.category) continue;
      if (filter.subcategory != '' && foodlist[i].subcategory != filter.subcategory) continue;
      if (filter.name!= '' && foodlist[i].name.toLowerCase().indexOf(filter.name.toLowerCase())<0) continue;
      var o = '';
      o += foodlist[i].name + ' | ';
      o += 'Portion: ' + foodlist[i].portion + ' ';
      o += foodlist[i].unit + ' | ';
      o += 'Carbs: ' + foodlist[i].carbs+' g';
      $('#bc_data').append(new Option(o,i));
    }
    $('#bc_addportions').val("1");
    
    if (event) event.preventDefault();
  }
  
  function addFoodFromDatabase(event) {
    if (!databaseloaded) {
      loadDatabase(addFoodFromDatabase);
      if (event) event.preventDefault();
      return;
    }
    
    $('#bc_addportions').val("1");
    $( "#bc_addfooddialog" ).dialog({
        width: 640
      , height: 400
      ,  buttons: [
        { text: translate("Add"),
          click: function() {
          var index = $('#bc_data').val();
          var portions = parseFloat($('#bc_addportions').val().replace(',','.'));
          if (index != null && !isNaN(portions) && portions >0) {
            foodlist[index].portions = portions;
            foods.push(_.cloneDeep(foodlist[index]));
            boluscalc.calculateInsulin();
            $( this ).dialog( "close" );
          }
          }
        },
        { text: translate("Reload database"),
          class: 'leftButton',
          click: loadDatabase
        }
        ]
      , open   : function(ev, ui) {
        $(this).parent().css('box-shadow', '20px 20px 20px 0px black');
        $(this).parent().find('.ui-dialog-buttonset'      ).css({'width':'100%','text-align':'right'})
        $(this).parent().find('button:contains("'+translate('Add')+'")').css({'float':'left'});
        $('#bc_filter_name').focus();
      }

    });
    if (event) event.preventDefault();
    return false;
  }

  function findClosestSGVToPastTime(time) {
        var closeBGs = Nightscout.client.data.filter(function(d) {
      if (d.color == 'transparent') return false;
      if (d.type != 'sgv') return false;
          if (!d.y) {
            return false;
          } else {
            return Math.abs((new Date(d.date)).getTime() - time) <= 10 * 60 * 1000;
          }
        });
    
    // If there are any in 10 min range try 5 min 1st
    var closeBG5m = closeBGs.filter(function(d) {
            return Math.abs((new Date(d.date)).getTime() - time) <= 5 * 60 * 1000;
        });
    if (closeBG5m.length>0) closeBGs = closeBG5m;

        var totalBG = 0;
        closeBGs.forEach(function(d) {
          totalBG += Number(d.y);
        });

        return totalBG > 0 ? Nightscout.utils.scaleBg(totalBG / closeBGs.length) : 0;
      }

  function isTouch() {
    try { document.createEvent('TouchEvent'); return true; }
    catch (e) { return false; }
  }

  if (typeof window !== 'undefined') { // this should be solved smarter way
    boluscalc.initGUI();
  }
  
  return boluscalc();

};

module.exports = init;