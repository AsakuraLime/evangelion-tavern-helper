const clampNumber = (min, max, fallback = min) => z.coerce.number().catch(fallback).transform(value => _.clamp(value, min, max));
const boolMap = z.record(z.string(), z.coerce.boolean()).prefault({});
const relation = z.object({
  亲密度: clampNumber(0, 100, 0).prefault(0),
  信赖: clampNumber(0, 100, 0).prefault(0),
  心之壁: clampNumber(0, 100, 50).prefault(50),
});

export const EvaSchema = z.object({
  元信息: z.object({
    已初始化: z.coerce.boolean().prefault(false),
    世界线: z.enum(['A', 'B']).prefault('A'),
    阶段: z.string().prefault('TV前期'),
    登记信息: z.string().prefault(''),
    履历摘要: z.string().prefault(''),
    入域事态: z.string().prefault(''),
    推论开关: boolMap,
  }),
  世界: z.object({
    日期: z.string().prefault('未确定'),
    时刻: z.string().prefault('未确定'),
    经过天数: clampNumber(0, 99999, 0).prefault(0),
    当前区域: z.string().prefault('未确定'),
    使徒警报: z.enum(['无', '观测', '接近', '交战']).prefault('无'),
    连续闲置回合: clampNumber(0, 999, 0).prefault(0),
  }),
  登记对象: z.object({
    姓名: z.string().prefault('{{user}}'),
    年龄: z.string().prefault('未登记'),
    性别: z.string().prefault('未登记'),
    出身地国籍: z.string().prefault('未登记'),
    外貌特征: z.string().prefault('未登记'),
    性格与行为习惯: z.string().prefault('未登记'),
    自述身份: z.string().prefault(''),
    所属组织: z.string().prefault('未确定'),
    权限与岗位: z.string().prefault('未登记'),
    权限等级: clampNumber(0, 5, 0).prefault(0),
    与EVA的关系: z.string().prefault('未登记'),
    是否可驾驶EVA: z.coerce.boolean().prefault(false),
    担当机体: z.string().prefault('无'),
    能力训练与限制: z.string().prefault('未登记'),
    既有关系: z.string().prefault('未登记'),
    当前目标: z.string().prefault('未登记'),
    秘密与隐瞒信息: z.string().prefault('未登记'),
    个人经历与背景: z.string().prefault('未登记'),
    行动意图与限制: z.string().prefault('未登记'),
    信息可见层级: boolMap,
  }),
  主角状态: z.object({
    同步率: clampNumber(-400, 400, 0).prefault(0),
    精神污染度: clampNumber(0, 100, 0).prefault(0),
    心之壁厚度: clampNumber(0, 100, 50).prefault(50),
    疲劳: clampNumber(0, 100, 0).prefault(0),
    机体损伤: z.record(z.string(), clampNumber(0, 100, 0)).prefault({}),
    残余活动时间: clampNumber(0, 99999, 0).prefault(0),
    DSS_Choker: z.coerce.boolean().prefault(false),
    诅咒: z.coerce.boolean().prefault(false),
  }),
  场景: z.object({在场人物: boolMap, 在场机体: boolMap}),
  人物关系: z.record(z.string(), relation).prefault({}),
  组织: z.record(z.string(), z.any()).prefault({}),
  事件: z.object({
    已发生: boolMap,
    已击破使徒: boolMap,
    当前主事件: z.string().prefault(''),
    当前环境事件: z.string().prefault(''),
    冷却: z.record(z.string(), clampNumber(0, 999, 0)).prefault({}),
  }),
  '$幕后': z.record(z.string(), z.any()).prefault({}),
  '_只读': z.record(z.string(), z.any()).prefault({}),
});

function registerSchema() {
  if (typeof registerVariableSchema !== 'function') throw new Error('缺少 registerVariableSchema');
  registerVariableSchema(z.object({stat_data: EvaSchema}), {type: 'message'});
  eventOn('mag_variable_initialized', data => {
    const parsed = EvaSchema.safeParse(data.stat_data || {});
    if (parsed.success) data.stat_data = {...data.stat_data, ...parsed.data};
    else toastr.error(z.prettifyError?.(parsed.error) || parsed.error.message, 'MAGI生体档案校验');
  });
}

$(async () => {
  await waitGlobalInitialized('Mvu');
  registerSchema();
  window.dispatchEvent(new CustomEvent('eva:schema-ready'));
  toastr.success('生体与档案监测接入', 'MAGI');
});
