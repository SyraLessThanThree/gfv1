import { preloadedTemplates } from "../../handlebars/preload.mjs";
import {
  deleteDoc,
  embraceTag,
  makeRoll,
  rollStrain,
  viewDoc,
} from "./itemControl.mjs";
import ItemProperty from "./itemProperty.mjs";

function getTooltip(item){
	if(item.system.tooltip !== "")
		return item.system.tooltip;
	if(item.system?.when === "" ||
		item.system?.when === null ||
		item.system?.when === undefined)
		return "";
	let str = item.system.when;
	if(!str.toLowerCase().startsWith("when "))
		str = "When "+item.system.when;
	return str;
}

export default class ListItem {
  constructor(dataModel, item) {
    this.dataModel = dataModel;
    this.item = item;
  }

  render({ actor, locked, playbookType, editable }) {
    const context = {
      item: this.item,
      uuid: this.item.uuid,
      tooltip: getTooltip(this.item),
      properties: this.dataModel.itemListProperties.map(
        (p) => new ItemProperty(this.dataModel, this.item, p),
      ),
      type: this.dataModel.type,
      controls: controls,
      actor,
      locked,
      playbookType,
      editable,
    };
    return preloadedTemplates.itemListEntry(context);
  }
}

const controls = [makeRoll, rollStrain, embraceTag, viewDoc, deleteDoc];
