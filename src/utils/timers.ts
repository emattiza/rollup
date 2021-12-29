import { InputOptions, Plugin, SerializedTimings } from '../rollup/types';
import { version } from 'package.json';
import { Span, trace, TracerProvider } from '@opentelemetry/api';

let provider: TracerProvider = trace.getTracerProvider();
let tracer = provider.getTracer("rollup", version);

type StartTime = [number, number];

interface Timer {
	memory: number;
	startMemory: number;
	startTime: StartTime;
	time: number;
	totalMemory: number;
}

interface Timers {
	[label: string]: Timer;
}

interface Spans {
	[spans: string]: Span
}

const NOOP = (): void => {};
let getStartTime = (): StartTime => [0, 0];
let getElapsedTime: (previous: StartTime) => number = () => 0;
let getMemory: () => number = () => 0;
let timers: Timers = {};
let spans: Spans = {};

const normalizeHrTime = (time: [number, number]) => time[0] * 1e3 + time[1] / 1e6;

function setTimeHelpers() {
	if (typeof process !== 'undefined' && typeof process.hrtime === 'function') {
		getStartTime = process.hrtime.bind(process);
		getElapsedTime = previous => normalizeHrTime(process.hrtime(previous));
	} else if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
		getStartTime = () => [performance.now(), 0];
		getElapsedTime = previous => performance.now() - previous[0];
	}
	if (typeof process !== 'undefined' && typeof process.memoryUsage === 'function') {
		getMemory = () => process.memoryUsage().heapUsed;
	}
}

function getPersistedLabel(label: string, level: number) {
	switch (level) {
		case 1:
			return `# ${label}`;
		case 2:
			return `## ${label}`;
		case 3:
			return label;
		default:
			return `${'  '.repeat(level - 4)}- ${label}`;
	}
}

function timeStartImpl(label: string, level = 3) {
	label = getPersistedLabel(label, level);
	if (!timers.hasOwnProperty(label)) {
		timers[label] = {
			memory: 0,
			startMemory: undefined as never,
			startTime: undefined as never,
			time: 0,
			totalMemory: 0
		};
	}
	const currentMemory = getMemory();
	timers[label].startTime = getStartTime();
	timers[label].startMemory = currentMemory;
}

function timeEndImpl(label: string, level = 3) {
	label = getPersistedLabel(label, level);
	if (timers.hasOwnProperty(label)) {
		const currentMemory = getMemory();
		timers[label].time += getElapsedTime(timers[label].startTime);
		timers[label].totalMemory = Math.max(timers[label].totalMemory, currentMemory);
		timers[label].memory += currentMemory - timers[label].startMemory;
	}
}

export function getTimings(): SerializedTimings {
	const newTimings: SerializedTimings = {};
	for (const [label, { time, memory, totalMemory }] of Object.entries(timers)) {
		newTimings[label] = [time, memory, totalMemory];
	}
	return newTimings;
}

export let timeStart: (label: string, level?: number) => void = NOOP,
	timeEnd: (label: string, level?: number) => void = NOOP;

const TIMED_PLUGIN_HOOKS: { [hook: string]: boolean } = {
	load: true,
	resolveDynamicImport: true,
	resolveId: true,
	transform: true
};

function getPluginWithTimers(plugin: any, index: number): Plugin {
	const timedPlugin: { [hook: string]: any } = {};

	for (const hook of Object.keys(plugin)) {
		if (TIMED_PLUGIN_HOOKS[hook] === true) {
			let timerLabel = `plugin ${index}`;
			if (plugin.name) {
				timerLabel += ` (${plugin.name})`;
			}
			timerLabel += ` - ${hook}`;
			timedPlugin[hook] = function (...args: unknown[]) {
				timeStart(timerLabel, 4);
				let result = plugin[hook].apply(this === timedPlugin ? plugin : this, args);
				timeEnd(timerLabel, 4);
				if (result && typeof result.then === 'function') {
					timeStart(`${timerLabel} (async)`, 4);
					result = result.then((hookResult: unknown) => {
						timeEnd(`${timerLabel} (async)`, 4);
						return hookResult;
					});
				}
				return result;
			};
		} else {
			timedPlugin[hook] = plugin[hook];
		}
	}
	return timedPlugin as Plugin;
}

export function initialiseTimers(inputOptions: InputOptions): void {
	if (inputOptions.perf) {
		timers = {};
		setTimeHelpers();
		timeStart = timeStartImpl;
		timeEnd = timeEndImpl;
		inputOptions.plugins = inputOptions.plugins!.map(getPluginWithTimers);
	} else {
		timeStart = NOOP;
		timeEnd = NOOP;
	}
	// trace input option overrides performance option impl
	if (inputOptions.trace) {
		spans = {};
		setTimeHelpers();
		timeStart = timeStartTraceImpl;
		timeEnd = timeEndTraceImpl;
		inputOptions.plugins = inputOptions.plugins!.map(getPluginWithSpan)
	}
}

function timeStartTraceImpl(label: string, _level?: number): void {
	if (!spans.hasOwnProperty(label)) {
		const new_span = tracer.startSpan(label)
		new_span.setAttributes({
			memory: 0,
			startMemory: undefined as never,
			endMemory: undefined as never,
			totalMemory: 0
		})
		spans[label] = new_span	
		const currentMemory = getMemory();
		spans[label].setAttribute("startMemory", currentMemory);
	}
}

function timeEndTraceImpl(label: string, _level?: number): void {
	if (timers.hasOwnProperty(label)) {
		const labeledSpan = spans[label];
		const currentMemory = getMemory();
		labeledSpan.setAttribute("totalMemory", Math.max(timers[label].totalMemory, currentMemory));
		labeledSpan.setAttribute("endMemory", currentMemory);
		labeledSpan.end()
	}
}

function getPluginWithSpan(plugin: any, _index: number): Plugin {
	return plugin
}
