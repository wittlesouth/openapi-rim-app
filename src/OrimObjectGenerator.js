/* OrimObjectGenerator.js - Generates redux-immutable-model objects */
import BaseModelGenerator from './BaseModelGenerator'

export default class OrimObjectGenerator extends BaseModelGenerator {
  constructor(config, modelObject) {
    super (modelObject,
      config['TEMPLATES']['PATH'] + '/' + config['TEMPLATES']['ORIM_OBJECT'],
      config['APP']['ORIM_OBJECT_PATH'] + '/Orim' + modelObject._name + '.js')
    this._sections = ['varnames', 'defvals', 'getters', 'validators',
                      'payloads', 'newvalids', 'createOnlys', 'patterns']
  }

  // Generates the class static constants representing field names in JSON payload
  getFieldConstant(prop) {
    return `static _${prop.getMixedName()}Key = '${prop.name}'`
  }

  // Generates statement to set default value for the property for new instances
  getDefaultValue(prop) {
    if (prop.getUpperName() === 'ID')
      return `this._data = Map({[${this._name}._IdentityKey]: ${this._name}._NewID,`
    else
      return `             [${this._name}._${prop.getMixedName()}Key]: ${prop.defaultValue()},`
  }

  // Generates the getter function for the property
  getGetter(prop) {
    let result = `get${prop.getMixedName()} () { return this._data.get(${this._name}._${prop.getMixedName()}Key) }`
    if (prop.type === 'string' && prop.format === 'date')
      result += `\n  get${prop.getMixedName()}String () { return this._data.get(${this._name}._${prop.getUpperName()}Key).toLocaleString() }`
    return result
  }

  // Generates the validator function for the property
  getValidator(prop) {
    const getter = `get${prop.getMixedName()}()`
    let resultConditions = []
    if (prop.minLength)
      resultConditions.push(`this.${getter}.length >= ${prop.minLength}`)
    if (prop.maxLength)
      resultConditions.push(`this.${getter}.length <= ${prop.maxLength}`)
    if (prop.enum)
      resultConditions.push(`['${prop.enum.join("','")}'].includes(this.${getter})`)
    if (prop.pattern)
      resultConditions.push(`${prop.name}Test.test(this.${getter})`)
    let result = ''
    if (!prop.nullable) {
      result = `this.${getter} !== undefined`
      if (resultConditions.length > 0) {
        result += " &&\n            "
        result += resultConditions.join(" &&\n          ")
      }
    } else {
      result += resultConditions.join(" &&\n          ")
      if (resultConditions.length > 0)
        result += ` ||\n          this.${getter} === undefined`
    }
    return `is${prop.getMixedName()}Valid () { return ${result} }`
  }

  // Generates payload element code for the property
  getPayloadElement(prop) {
    let transform = ""
    if (prop.type === 'object') transform = ".toJS()"
    else if (prop.type === 'string' && prop.format === 'date') transform = ".toJSON()"
    return `[${this._name}._${prop.getMixedName()}Key]: this.get${prop.getMixedName()}()${transform},`
  }

  // Generates property validation call for new object validity test
  getNewValidation(prop) {
    return `if (!this.is${prop.getMixedName()}Valid()) { return ${this._name}.msgs.invalid${prop.getMixedName()}Message }`
  }

  // Generates input transformation code for reading response payloads
  getInputTransform(prop) {
    return `this._data = this.data.set(${this._name}.${prop.getUpperName()}, new Date(paramObj[${this._name}.${prop.getUpperName()}]))`
  }

  // Generates code to remove create-only fields from payload
  getCreateOnly(prop) {
    return `delete payload.${prop.name}`
  }

  // Generates code to create a regular express test for any strings with pattern specified
  getPatternDef(prop) {
    return `const ${prop.name}Test = ${prop.pattern}`
  }

  getInitialContext() {
    const result = super.getInitialContext()
    result['desc'] = this._modelObject._description
    this._sections.forEach((key) => {
      result[key] = []
    })
    return result
  }

  processProperty(context, prop) {
    context['varnames'].push(this.getFieldConstant(prop))
    context['defvals'].push(this.getDefaultValue(prop))
    context['getters'].push(this.getGetter(prop))
    if (prop.needsInputTransform()) context['transforms'].push(this.getInputTransform(prop))
    if (prop.needsValidation()) {
        context['validators'].push(this.getValidator(prop))
        context['newvalids'].push(this.getNewValidation(prop))
    }
    if (prop.getUpperName() != 'ID') context['payloads'].push(this.getPayloadElement(prop))
    if (prop.createOnly) context['createOnlys'].push(this.getCreateOnly(prop))
    if (prop.pattern) context['patterns'].push(this.getPatternDef(prop))
    return context
  }

  finalizeContext(context) {
    // Default values last element needs to not have trailing commna, and have object and function close
    context['defvals'][context['defvals'].length-1] = context['defvals'][context['defvals'].length-1].slice(0, -1) + "})"
    // Payloads value list needs to not have a trailing comma
    context['payloads'][context['payloads'].length-1] = context['payloads'][context['payloads'].length-1].slice(0, -1)
    return context
  }
}