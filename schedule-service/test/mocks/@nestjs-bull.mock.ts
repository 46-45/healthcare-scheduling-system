// Mock for @nestjs/bull module to avoid ESM import issues in Jest

export const BullModule = {
  forRoot: jest.fn().mockReturnValue({
    module: class MockBullModule {},
    providers: [],
    exports: [],
  }),
  forRootAsync: jest.fn().mockReturnValue({
    module: class MockBullModule {},
    providers: [],
    exports: [],
  }),
  registerQueue: jest.fn().mockReturnValue({
    module: class MockBullQueueModule {},
    providers: [],
    exports: [],
  }),
};

export function InjectQueue(name?: string): ParameterDecorator {
  return (target: Object, propertyKey: string | symbol, parameterIndex: number) => {
    // Mock decorator - does nothing in tests
  };
}

export function Processor(name?: string): ClassDecorator {
  return (target: Function) => {
    // Mock decorator - does nothing in tests
  };
}

export function Process(name?: string): MethodDecorator {
  return (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    // Mock decorator - does nothing in tests
  };
}

export function getQueueToken(name: string): string {
  return `BullQueue_${name}`;
}
